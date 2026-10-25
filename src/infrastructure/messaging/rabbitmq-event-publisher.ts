import type { ConfirmChannel } from "amqplib";
import { v7 as uuidv7 } from "uuid";
import type {
  EventPublisher,
  IntegrationEvent,
  IntegrationEventDefinition,
} from "../../application/abstractions/messaging/integration-event.js";
import type { RabbitMqConnection } from "./rabbitmq-connection.js";
import { assertExchanges, EVENTS_EXCHANGE } from "./rabbitmq-topology.js";

const PUBLISH_TIMEOUT_MS = 10_000;

/**
 * Publishes persistent messages with publisher confirms: a resolved `publish` means the broker has
 * taken responsibility for the message. Fails after a timeout while the broker is unreachable.
 */
export class RabbitMqEventPublisher implements EventPublisher {
  #channel: Promise<ConfirmChannel> | null = null;

  constructor(private readonly connection: RabbitMqConnection) {}

  async publish<TPayload>(
    definition: IntegrationEventDefinition<TPayload>,
    payload: TPayload,
  ): Promise<void> {
    const event: IntegrationEvent<TPayload> = {
      eventId: uuidv7(),
      occurredAt: new Date().toISOString(),
      payload: definition.schema.parse(payload),
    };
    await withTimeout(this.send(definition.routingKey, event), PUBLISH_TIMEOUT_MS);
  }

  private async send(routingKey: string, event: IntegrationEvent<unknown>): Promise<void> {
    const channel = await this.getChannel();
    await new Promise<void>((resolve, reject) => {
      channel.publish(
        EVENTS_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: "application/json",
          messageId: event.eventId,
          type: routingKey,
          timestamp: Math.floor(Date.parse(event.occurredAt) / 1000),
        },
        (error: unknown) => {
          if (error) reject(error instanceof Error ? error : new Error("Broker rejected the message."));
          else resolve();
        },
      );
    });
  }

  private getChannel(): Promise<ConfirmChannel> {
    this.#channel ??= this.openChannel().catch((error: unknown) => {
      this.#channel = null;
      throw error;
    });
    return this.#channel;
  }

  private async openChannel(): Promise<ConfirmChannel> {
    const channel = await this.connection.createConfirmChannel();
    channel.on("close", () => {
      this.#channel = null;
    });
    channel.on("error", () => {
      this.#channel = null;
    });
    await assertExchanges(channel);
    return channel;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Publishing timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
