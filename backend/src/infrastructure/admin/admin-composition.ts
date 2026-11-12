import type { AdminContext } from "../../application/features/admin/admin-context.js";
import type { IdentityContext } from "../../application/features/identity/identity-context.js";
import type { Infrastructure } from "../infrastructure.js";
import { RabbitMqQueueInspector } from "../messaging/queue-inspector.js";
import { WORKER_QUEUES } from "../messaging/worker-subscriptions.js";
import type { ModerationContext } from "../moderation/moderation-composition.js";
import { MongoAdminReadModel } from "./mongo-admin-read-model.js";
import type { RedisLiveStats } from "./redis-live-stats.js";

export function createAdminContext(
  infrastructure: Infrastructure,
  moderation: ModerationContext,
  identity: IdentityContext,
  liveStats: RedisLiveStats,
): AdminContext {
  return {
    reports: moderation.reports,
    banRepository: moderation.banRepository,
    bans: moderation.bans,
    trust: moderation.trust,
    audit: moderation.audit,
    notifier: moderation.notifier,
    textRules: moderation.textRules,
    users: identity.users,
    refreshTokens: identity.refreshTokens,
    hasher: identity.hasher,
    readModel: new MongoAdminReadModel(infrastructure.database),
    liveStats,
    queues: new RabbitMqQueueInspector(infrastructure.rabbitMq, WORKER_QUEUES),
    clock: identity.clock,
  };
}
