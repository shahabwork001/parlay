import { setTimeout as delay } from "node:timers/promises";
import type { ConfirmChannel, ConsumeMessage } from "amqplib";
import { z } from "zod";
import type {
  IntegrationEvent,
  IntegrationEventDefinition,
  IntegrationEventHandler,
} from "../../application/abstractions/messaging/integration-event.js";
import type { Logger } from "../observability/logger.js";
import type { RabbitMqConnection } from "./rabbitmq-connection.js";
import { assertSubscription } from "./rabbitmq-topology.js";

export const ATTEMPT_HEADER = "x-parley-attempt";
const MAX_RETRY_DELAY_MS = 30_000;

export interface ConsumerOptions<TPayload> {
  /** Logical subscriber name; the queue is `parley.{subscriber}.{routingKey}`. */
  readonly subscriber: string;
  readonly definition: IntegrationEventDefinition<TPayload>;
  readonly handler: IntegrationEventHandler<TPayload>;
  readonly prefetch: number;
  /** Total handler attempts before a message is dead-lettered. */
  readonly deliveryLimit: number;
  /** Base delay for exponential retry backoff (doubles per attempt, capped at 30 s). */
  readonly retryDelayMs: number;
}

/**
 * Consumes one event type from a dedicated quorum queue.
 *
 * Retries are counted by the consumer: a failed message is republished to its queue with an
 * incremented `x-parley-attempt` header after an exponential backoff, then the original is acked.
 * (RabbitMQ 4 does not count `nack` requeues toward a quorum queue's delivery limit.) After
 * `deliveryLimit` attempts, or immediately for malformed messages, the message is dead-lettered.
 * The queue's own `x-delivery-limit` still guards against consumers that crash mid-message.
 * Re-subscribes automatically after a broker reconnect.
 */
export interface MessageConsumer {
  readonly queue: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class RabbitMqConsumer<TPayload> implements MessageConsumer {
  readonly queue: string;
  readonly #envelope: z.ZodType<IntegrationEvent<TPayload>>;
  #channel: ConfirmChannel | null = null;
  #subscribing = false;
  #stopped = false;
  #unsubscribe: (() => void) | null = null;

  constructor(
    private readonly connection: RabbitMqConnection,
    private readonly options: ConsumerOptions<TPayload>,
    private readonly logger: Logger,
  ) {
    this.queue = `parley.${options.subscriber}.${options.definition.routingKey}`;
    this.#envelope = z.object({
      eventId: z.string().min(1),
      occurredAt: z.iso.datetime(),
      payload: options.definition.schema,
    });
  }

  async start(): Promise<void> {
    this.#stopped = false;
    this.#unsubscribe = this.connection.onConnect(() => {
      void this.subscribe();
    });
    await this.subscribe();
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    this.#unsubscribe?.();
    const channel = this.#channel;
    this.#channel = null;
    await channel?.close().catch(() => undefined);
  }

  private async subscribe(): Promise<void> {
    if (this.#stopped || this.#subscribing || this.#channel) return;
    this.#subscribing = true;
    try {
      const channel = await this.connection.createConfirmChannel();
      channel.on("error", (error: Error) => {
        this.logger.warn({ err: error, queue: this.queue }, "Consumer channel error");
      });
      channel.on("close", () => {
        if (this.#channel === channel) this.#channel = null;
      });
      await channel.prefetch(this.options.prefetch);
      await assertSubscription(
        channel,
        this.queue,
        this.options.definition.routingKey,
        this.options.deliveryLimit + 1,
      );
      await channel.consume(this.queue, (message) => {
        if (message) void this.handle(channel, message);
      });
      this.#channel = channel;
      this.logger.info({ queue: this.queue }, "Consuming");
    } catch (error) {
      this.logger.error({ err: error, queue: this.queue }, "Failed to subscribe; will retry on reconnect");
    } finally {
      this.#subscribing = false;
    }
  }

  private async handle(channel: ConfirmChannel, message: ConsumeMessage): Promise<void> {
    const event = this.parse(message);
    if (!event) {
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.options.handler.handle(event);
      channel.ack(message);
    } catch (error) {
      await this.retryOrDeadLetter(channel, message, event.eventId, error);
    }
  }

  private async retryOrDeadLetter(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    eventId: string,
    error: unknown,
  ): Promise<void> {
    const attempt = attemptOf(message);
    if (attempt >= this.options.deliveryLimit) {
      this.logger.error(
        { err: error, queue: this.queue, eventId, attempt },
        "Handler failed; dead-lettering",
      );
      channel.nack(message, false, false);
      return;
    }

    this.logger.warn({ err: error, queue: this.queue, eventId, attempt }, "Handler failed; retrying");
    await delay(Math.min(this.options.retryDelayMs * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS));
    try {
      await this.republish(channel, message, attempt + 1);
      channel.ack(message);
    } catch (republishError) {
      this.logger.error(
        { err: republishError, queue: this.queue, eventId },
        "Retry republish failed; requeueing",
      );
      channel.nack(message, false, true);
    }
  }

  private republish(channel: ConfirmChannel, message: ConsumeMessage, nextAttempt: number): Promise<void> {
    const { properties } = message;
    return new Promise((resolve, reject) => {
      channel.sendToQueue(
        this.queue,
        message.content,
        {
          persistent: true,
          contentType: properties.contentType as string | undefined,
          messageId: properties.messageId as string | undefined,
          type: properties.type as string | undefined,
          timestamp: properties.timestamp as number | undefined,
          headers: { ...properties.headers, [ATTEMPT_HEADER]: nextAttempt },
        },
        (error: unknown) => {
          if (error) reject(error instanceof Error ? error : new Error("Broker rejected the retry."));
          else resolve();
        },
      );
    });
  }

  private parse(message: ConsumeMessage): IntegrationEvent<TPayload> | null {
    try {
      const result = this.#envelope.safeParse(JSON.parse(message.content.toString("utf8")));
      if (result.success) return result.data;
      this.logger.error(
        { queue: this.queue, issues: result.error.issues },
        "Invalid message; dead-lettering",
      );
    } catch (error) {
      this.logger.error({ err: error, queue: this.queue }, "Malformed JSON; dead-lettering");
    }
    return null;
  }
}

function attemptOf(message: ConsumeMessage): number {
  const value: unknown = message.properties.headers?.[ATTEMPT_HEADER];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}
