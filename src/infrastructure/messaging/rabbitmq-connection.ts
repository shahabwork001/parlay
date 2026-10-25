import { connect, type Channel, type ConfirmChannel, type RecoveringChannelModel } from "amqplib";
import type { HealthCheck, HealthCheckResult } from "../health/health-check.js";
import type { Logger } from "../observability/logger.js";

/**
 * One auto-recovering broker connection per process. amqplib re-establishes the connection with
 * exponential backoff, but channels die with it, so channel owners re-create them via `onConnect`.
 */
export class RabbitMqConnection {
  #connected = false;
  readonly #listeners = new Set<() => void>();

  private constructor(
    private readonly model: RecoveringChannelModel,
    private readonly logger: Logger,
  ) {
    model.on("connect", () => {
      this.#connected = true;
      logger.info("RabbitMQ connected");
      for (const listener of this.#listeners) listener();
    });
    model.on("disconnect", (error: Error) => {
      this.#connected = false;
      logger.warn({ err: error }, "RabbitMQ disconnected; reconnecting");
    });
    model.on("error", (error: Error) => {
      logger.warn({ err: error }, "RabbitMQ connection error");
    });
  }

  /** Resolves immediately; the first connection attempt continues in the background. */
  static async open(url: string, logger: Logger, clientName: string): Promise<RabbitMqConnection> {
    const model = await connect(url, {
      clientProperties: { connection_name: clientName },
      recovery: { initialDelay: 500, maxDelay: 15_000, waitForConnect: false },
    });
    return new RabbitMqConnection(model, logger);
  }

  get isConnected(): boolean {
    return this.#connected;
  }

  /** Called after every (re)connection. Returns an unsubscribe function. */
  onConnect(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  createChannel(): Promise<Channel> {
    return this.model.createChannel();
  }

  createConfirmChannel(): Promise<ConfirmChannel> {
    return this.model.createConfirmChannel();
  }

  async close(): Promise<void> {
    this.#listeners.clear();
    await this.model.close();
    this.logger.info("RabbitMQ connection closed");
  }
}

export class RabbitMqHealthCheck implements HealthCheck {
  readonly name = "rabbitmq";

  constructor(private readonly connection: RabbitMqConnection) {}

  check(): Promise<HealthCheckResult> {
    return Promise.resolve(
      this.connection.isConnected
        ? { status: "Healthy" }
        : { status: "Unhealthy", description: "Not connected to RabbitMQ." },
    );
  }
}
