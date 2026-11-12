import type {
  IntegrationEventDefinition,
  IntegrationEventHandler,
} from "../application/abstractions/messaging/integration-event.js";
import { RecordPartnerBlock } from "../application/features/chat/blocks.js";
import { AuditBanIssued } from "../application/features/moderation/evidence-access.js";
import { ScoreReport } from "../application/features/moderation/scoring.js";
import {
  PenaliseFlaggedContent,
  RewardCleanSession,
} from "../application/features/moderation/trust-handlers.js";
import type { EmailSender } from "../application/features/notifications/send-requested-email.js";
import { SendRequestedEmail } from "../application/features/notifications/send-requested-email.js";
import type { WorkersConfig } from "../infrastructure/config/config.js";
import type { Infrastructure } from "../infrastructure/infrastructure.js";
import { type MessageConsumer, RabbitMqConsumer } from "../infrastructure/messaging/rabbitmq-consumer.js";
import { WORKER_SUBSCRIPTIONS } from "../infrastructure/messaging/worker-subscriptions.js";
import type { ModerationContext } from "../infrastructure/moderation/moderation-composition.js";
import type { Logger } from "../infrastructure/observability/logger.js";
import { MongoBlockRepository } from "../infrastructure/persistence/mongo/block-repository.js";

export interface WorkerDependencies {
  readonly infrastructure: Infrastructure;
  readonly moderation: ModerationContext;
  readonly config: WorkersConfig;
  readonly logger: Logger;
  readonly emailSender: EmailSender;
}

/**
 * Every event subscription hosted by the workers process, one consumer per entry of
 * `WORKER_SUBSCRIPTIONS` (analytics aggregation and cleanup arrive in later phases).
 */
export function createConsumers(dependencies: WorkerDependencies): MessageConsumer[] {
  const { infrastructure, moderation, config, logger } = dependencies;
  const consumerOptions = {
    prefetch: config.rabbitMq.prefetch,
    deliveryLimit: config.rabbitMq.deliveryLimit,
    retryDelayMs: config.rabbitMq.retryDelayMs,
  };
  const consumer = <T>(
    subscription: { subscriber: string; definition: IntegrationEventDefinition<T> },
    handler: IntegrationEventHandler<T>,
  ) =>
    new RabbitMqConsumer(
      infrastructure.rabbitMq,
      { ...subscription, handler, ...consumerOptions },
      logger.child({ consumer: `${subscription.subscriber}.${subscription.definition.routingKey}` }),
    );

  const subscriptions = WORKER_SUBSCRIPTIONS;
  return [
    consumer(subscriptions.email, new SendRequestedEmail(dependencies.emailSender)),
    consumer(subscriptions.blocks, new RecordPartnerBlock(new MongoBlockRepository(infrastructure.database))),
    consumer(
      subscriptions.scoring,
      new ScoreReport({
        blocks: new MongoBlockRepository(infrastructure.database),
        reports: moderation.reports,
        evidence: moderation.evidence,
        classifier: moderation.classifier,
        trust: moderation.trust,
        bans: moderation.bans,
        policy: moderation.policy,
        clock: () => new Date(),
      }),
    ),
    consumer(subscriptions.trustSessions, new RewardCleanSession(moderation.trust)),
    consumer(subscriptions.trustFlags, new PenaliseFlaggedContent(moderation.trust)),
    consumer(subscriptions.auditBans, new AuditBanIssued(moderation.audit)),
  ];
}
