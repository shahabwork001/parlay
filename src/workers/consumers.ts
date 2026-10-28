import type {
  IntegrationEventDefinition,
  IntegrationEventHandler,
} from "../application/abstractions/messaging/integration-event.js";
import { PartnerBlocked, RecordPartnerBlock } from "../application/features/chat/blocks.js";
import { EmailRequested } from "../application/features/identity/events.js";
import { AuditBanIssued } from "../application/features/moderation/evidence-access.js";
import {
  BanIssued,
  ContentFlagged,
  ReportSubmitted,
  SessionEnded,
} from "../application/features/moderation/events.js";
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
 * Every event subscription hosted by the workers process. Features add their consumers here
 * (analytics aggregation and cleanup arrive in later phases).
 */
export function createConsumers(dependencies: WorkerDependencies): MessageConsumer[] {
  const { infrastructure, moderation, config, logger } = dependencies;
  const consumerOptions = {
    prefetch: config.rabbitMq.prefetch,
    deliveryLimit: config.rabbitMq.deliveryLimit,
    retryDelayMs: config.rabbitMq.retryDelayMs,
  };
  const consumer = <T>(
    subscriber: string,
    name: string,
    definition: IntegrationEventDefinition<T>,
    handler: IntegrationEventHandler<T>,
  ) =>
    new RabbitMqConsumer(
      infrastructure.rabbitMq,
      { subscriber, definition, handler, ...consumerOptions },
      logger.child({ consumer: name }),
    );

  return [
    consumer(
      "notifications",
      "notifications.email",
      EmailRequested,
      new SendRequestedEmail(dependencies.emailSender),
    ),
    consumer(
      "chat",
      "chat.blocks",
      PartnerBlocked,
      new RecordPartnerBlock(new MongoBlockRepository(infrastructure.database)),
    ),
    consumer(
      "moderation",
      "moderation.scoring",
      ReportSubmitted,
      new ScoreReport({
        reports: moderation.reports,
        evidence: moderation.evidence,
        classifier: moderation.classifier,
        trust: moderation.trust,
        bans: moderation.bans,
        policy: moderation.policy,
        clock: () => new Date(),
      }),
    ),
    consumer("trust", "trust.sessions", SessionEnded, new RewardCleanSession(moderation.trust)),
    consumer("trust", "trust.flags", ContentFlagged, new PenaliseFlaggedContent(moderation.trust)),
    consumer("audit", "audit.bans", BanIssued, new AuditBanIssued(moderation.audit)),
  ];
}
