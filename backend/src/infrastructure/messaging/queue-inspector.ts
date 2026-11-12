import type { QueueDepth, QueueInspector } from "../../application/features/admin/admin-read-model.js";
import type { RabbitMqConnection } from "./rabbitmq-connection.js";

/** Queue name for a subscriber and routing key (the same rule `RabbitMqConsumer` uses). */
export const subscriptionQueue = (subscriber: string, routingKey: string) =>
  `parley.${subscriber}.${routingKey}`;

/**
 * Message counts for the workers' queues and their dead-letter queues, read with passive
 * `checkQueue` calls. A queue that does not exist yet (workers never started) reports zero.
 */
export class RabbitMqQueueInspector implements QueueInspector {
  constructor(
    private readonly connection: RabbitMqConnection,
    private readonly queues: readonly string[],
  ) {}

  async depths(): Promise<QueueDepth[]> {
    const names = this.queues.flatMap((queue) => [queue, `${queue}.dead-letter`]);
    const results: QueueDepth[] = [];
    for (const queue of names) {
      // A failed passive check closes its channel, so each check gets its own.
      const channel = await this.connection.createChannel();
      channel.on("error", () => undefined);
      try {
        const info = await channel.checkQueue(queue);
        results.push({ queue, messages: info.messageCount, consumers: info.consumerCount });
      } catch {
        results.push({ queue, messages: 0, consumers: 0 });
      } finally {
        await channel.close().catch(() => undefined);
      }
    }
    return results;
  }
}
