import type { WorkersConfig } from "../infrastructure/config/config.js";
import type { Infrastructure } from "../infrastructure/infrastructure.js";
import type { RabbitMqConsumer } from "../infrastructure/messaging/rabbitmq-consumer.js";
import type { Logger } from "../infrastructure/observability/logger.js";

/**
 * Every event subscription hosted by the workers process. Features add their consumers here
 * (moderation pipeline, analytics aggregation, audit log, cleanup).
 */
export function createConsumers(
  _infrastructure: Infrastructure,
  _config: WorkersConfig,
  _logger: Logger,
): RabbitMqConsumer<unknown>[] {
  return [];
}
