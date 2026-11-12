import type { Principal } from "../identity/ports.js";
import type { Clock, KeyedHasher, RefreshTokenStore, UserRepository } from "../identity/ports.js";
import type { BanService } from "../moderation/bans.js";
import type {
  AuditActor,
  AuditLog,
  BanRepository,
  ModerationNotifier,
  ReportRepository,
  TextRulesRepository,
  TrustStore,
} from "../moderation/ports.js";
import type { AdminReadModel, LiveStats, QueueInspector } from "./admin-read-model.js";

/** Everything the admin use cases need, assembled once in the composition root. */
export interface AdminContext {
  readonly reports: ReportRepository;
  readonly banRepository: BanRepository;
  readonly bans: BanService;
  readonly trust: TrustStore;
  readonly audit: AuditLog;
  readonly notifier: ModerationNotifier;
  readonly textRules: TextRulesRepository;
  readonly users: UserRepository;
  readonly refreshTokens: RefreshTokenStore;
  readonly hasher: KeyedHasher;
  readonly readModel: AdminReadModel;
  readonly liveStats: LiveStats;
  readonly queues: QueueInspector;
  readonly clock: Clock;
}

export const staffActor = (staff: Principal): AuditActor => ({
  kind: "staff",
  subjectId: staff.subjectId,
  roles: staff.roles,
});
