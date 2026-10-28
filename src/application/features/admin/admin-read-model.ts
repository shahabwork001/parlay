import type { EntityId } from "../../../domain/common/entity.js";
import type { Role } from "../../../domain/identity/roles.js";
import type { BanMode, BanReason, BanSource, BanTargetKind } from "../../../domain/moderation/ban.js";
import type {
  EscalationStatus,
  PriorityTier,
  ReportCategory,
  ReportOutcome,
  ReportStatus,
} from "../../../domain/moderation/report.js";
import type { PagedResult, PageRequest } from "../../common/paging.js";
import type { AuditEntry } from "../moderation/ports.js";

/*
 * Read side of the admin panel (CQRS-lite, ADR 0004): list and search views served straight from
 * MongoDB projections, without loading aggregates.
 */

export interface ReportSummary {
  readonly id: EntityId;
  readonly category: ReportCategory;
  /** The start of the reporter's note, so reviewers can tell reports apart in the list. */
  readonly notePreview: string | null;
  readonly mode: "text" | "video";
  readonly tier: PriorityTier;
  readonly priority: number;
  readonly status: ReportStatus;
  readonly outcome: ReportOutcome | null;
  readonly escalation: EscalationStatus | null;
  readonly hasEvidence: boolean;
  readonly labels: readonly string[];
  readonly reportedKind: "user" | "anonymous";
  readonly createdAt: Date;
}

export interface ReportListQuery {
  readonly status: "open" | "resolved" | "all";
  readonly tier?: PriorityTier;
  readonly reportedSubjectId?: string;
  readonly page: PageRequest;
}

export interface BanSummary {
  readonly id: EntityId;
  readonly targets: readonly { readonly kind: BanTargetKind; readonly value: string }[];
  readonly mode: BanMode;
  readonly reason: BanReason;
  readonly message: string | null;
  readonly source: BanSource;
  readonly createdBy: EntityId | null;
  readonly reportId: EntityId | null;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly liftedAt: Date | null;
  readonly appeal: {
    readonly message: string;
    readonly status: "pending" | "accepted" | "rejected";
    readonly submittedAt: Date;
  } | null;
}

export interface BanListQuery {
  readonly filter: "active" | "appeals" | "all";
  /** Only bans that target this account or device id. */
  readonly targetValue?: string;
  readonly page: PageRequest;
}

export interface UserSummary {
  readonly id: EntityId;
  readonly email: string;
  readonly roles: readonly Role[];
  readonly emailVerified: boolean;
  readonly twoFactorEnabled: boolean;
  readonly createdAt: Date;
}

/** One sign-in (refresh-token family): metadata only, never content. */
export interface SessionSummary {
  readonly familyId: string;
  readonly deviceId: EntityId;
  readonly mfa: boolean;
  readonly startedAt: Date;
  readonly lastActiveAt: Date;
  readonly active: boolean;
}

export interface AuditListQuery {
  readonly action?: string;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly page: PageRequest;
}

export interface StoredAuditEntry extends Omit<AuditEntry, "id"> {
  readonly id: string;
}

export interface AdminReadModel {
  listReports(query: ReportListQuery): Promise<PagedResult<ReportSummary>>;
  /** Report counts against the subject: all time, upheld, and in the last 24 hours. */
  reportCounts(subjectId: string, now: Date): Promise<{ total: number; upheld: number; lastDay: number }>;
  /** Reports filed by the subject, and how many of them were dismissed. */
  filedCounts(subjectId: string): Promise<{ total: number; dismissed: number }>;
  listBans(query: BanListQuery, now: Date): Promise<PagedResult<BanSummary>>;
  searchUsers(query: string, page: PageRequest): Promise<PagedResult<UserSummary>>;
  userSessions(userId: string, now: Date): Promise<SessionSummary[]>;
  listStaff(): Promise<UserSummary[]>;
  listAudit(query: AuditListQuery): Promise<PagedResult<StoredAuditEntry>>;
  /** Report counts per hour for the last `hours` hours (oldest first). */
  reportsPerHour(hours: number, now: Date): Promise<number[]>;
  openReportsByTier(): Promise<Record<PriorityTier, number>>;
  pendingAppeals(): Promise<number>;
}

/** Live numbers from the matchmaking state (Redis). */
export interface LiveStats {
  online(): Promise<number>;
  waiting(): Promise<{ text: number; video: number }>;
  activeSessions(): Promise<number>;
  /** Matches per minute for the last `minutes` minutes (oldest first). */
  matchesPerMinute(minutes: number, now: Date): Promise<number[]>;
  /** Average time the earlier person waited before being matched, over the last `minutes`, or null. */
  averageWaitMs(minutes: number, now: Date): Promise<number | null>;
}

export interface QueueDepth {
  readonly queue: string;
  readonly messages: number;
  readonly consumers: number;
}

export interface QueueInspector {
  depths(): Promise<QueueDepth[]>;
}
