import { PartnerBlocked, RecordPartnerBlock } from "../application/features/chat/blocks.js";
import { EmailRequested } from "../application/features/identity/events.js";
import { SendRequestedEmail } from "../application/features/notifications/send-requested-email.js";
import type { WorkersConfig } from "../infrastructure/config/config.js";
import type { EmailSender } from "../application/features/notifications/send-requested-email.js";
import type { Infrastructure } from "../infrastructure/infrastructure.js";
import { type MessageConsumer, RabbitMqConsumer } from "../infrastructure/messaging/rabbitmq-consumer.js";
import type { Logger } from "../infrastructure/observability/logger.js";
import { MongoBlockRepository } from "../infrastructure/persistence/mongo/block-repository.js";

export interface WorkerDependencies {
  readonly infrastructure: Infrastructure;
  readonly config: WorkersConfig;
  readonly logger: Logger;
  readonly emailSender: EmailSender;
}

/**
 * Every event subscription hosted by the workers process. Features add their consumers here
 * (moderation pipeline, analytics aggregation, audit log, cleanup).
 */
export function createConsumers(dependencies: WorkerDependencies): MessageConsumer[] {
  const { infrastructure, config, logger } = dependencies;
  const consumerOptions = {
    prefetch: config.rabbitMq.prefetch,
    deliveryLimit: config.rabbitMq.deliveryLimit,
    retryDelayMs: config.rabbitMq.retryDelayMs,
  };

  return [
    new RabbitMqConsumer(
      infrastructure.rabbitMq,
      {
        subscriber: "notifications",
        definition: EmailRequested,
        handler: new SendRequestedEmail(dependencies.emailSender),
        ...consumerOptions,
      },
      logger.child({ consumer: "notifications.email" }),
    ),
    new RabbitMqConsumer(
      infrastructure.rabbitMq,
      {
        subscriber: "chat",
        definition: PartnerBlocked,
        handler: new RecordPartnerBlock(new MongoBlockRepository(infrastructure.database)),
        ...consumerOptions,
      },
      logger.child({ consumer: "chat.blocks" }),
    ),
  ];
}
