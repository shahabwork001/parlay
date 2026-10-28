import type { RecentMessages } from "../../application/features/chat/recent-messages.js";
import { BanService } from "../../application/features/moderation/bans.js";
import {
  defaultModerationPolicy,
  type ModerationPolicy,
} from "../../application/features/moderation/moderation-policy.js";
import type {
  AuditLog,
  BanRepository,
  ContentClassifier,
  EventCounter,
  EvidenceStore,
  ReportRepository,
  TextRulesProvider,
  TrustStore,
} from "../../application/features/moderation/ports.js";
import { RedisRecentMessages } from "../chat/redis-recent-messages.js";
import type { InfrastructureConfig } from "../config/config.js";
import type { Infrastructure } from "../infrastructure.js";
import { HeuristicContentClassifier } from "./heuristic-classifier.js";
import { MongoAuditLog } from "./mongo-audit-log.js";
import { MongoBanRepository } from "./mongo-ban-repository.js";
import { MongoEvidenceStore } from "./mongo-evidence-store.js";
import { MongoReportRepository } from "./mongo-report-repository.js";
import { RedisBanCache } from "./redis-ban-cache.js";
import { RedisEventCounter } from "./redis-event-counter.js";
import { SocketBanEnforcer } from "./socket-ban-enforcer.js";
import { MongoTextRulesProvider } from "./text-rules-store.js";
import { CachedTrustStore } from "./trust-store.js";

/** Moderation adapters shared by the API and the workers. */
export interface ModerationContext {
  readonly policy: ModerationPolicy;
  readonly reports: ReportRepository;
  readonly banRepository: BanRepository;
  readonly bans: BanService;
  readonly evidence: EvidenceStore;
  readonly audit: AuditLog;
  readonly trust: TrustStore;
  readonly textRules: TextRulesProvider;
  readonly classifier: ContentClassifier;
  readonly counter: EventCounter;
  readonly recentMessages: RecentMessages;
}

export function createModerationContext(
  infrastructure: Infrastructure,
  config: InfrastructureConfig,
  clock: () => Date = () => new Date(),
): ModerationContext {
  const { database, redis } = infrastructure;
  const banRepository = new MongoBanRepository(database);
  const textRules = new MongoTextRulesProvider(database);
  return {
    policy: defaultModerationPolicy(config.moderation),
    reports: new MongoReportRepository(database),
    banRepository,
    bans: new BanService(
      banRepository,
      new RedisBanCache(redis),
      new SocketBanEnforcer(redis),
      infrastructure.eventPublisher,
      clock,
    ),
    evidence: new MongoEvidenceStore(database),
    audit: new MongoAuditLog(database),
    trust: new CachedTrustStore(database, redis, clock),
    textRules,
    classifier: new HeuristicContentClassifier(textRules),
    counter: new RedisEventCounter(redis),
    recentMessages: new RedisRecentMessages(redis),
  };
}
