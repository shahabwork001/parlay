import type { EntityId } from "../../../domain/common/entity.js";
import type { Role } from "../../../domain/identity/roles.js";
import type { Ban, BanTarget } from "../../../domain/moderation/ban.js";
import type { Report, ReportScore } from "../../../domain/moderation/report.js";
import type { TextRules } from "../../../domain/moderation/text-rules.js";
import type { Repository } from "../../abstractions/persistence/repository.js";

export interface ReportRepository extends Repository<Report> {
  isScoringComplete(id: string): Promise<boolean>;
  completeScoring(id: string): Promise<void>;
  pendingScoring(): Promise<string[]>;
  existsForSession(sessionId: string, reporterSubjectId: string): Promise<boolean>;
  /** Reports filed against the subject since the given time, and how many different people filed them. */
  countAgainst(subjectId: string, since: Date): Promise<{ reports: number; distinctReporters: number }>;
}

export interface BanRepository extends Repository<Ban> {
  /** Active bans matching any of the targets. */
  findActive(targets: readonly BanTarget[], now: Date): Promise<Ban[]>;
  /** Every active ban, for rebuilding the cache. */
  listActive(now: Date): Promise<Ban[]>;
}

export interface CachedBan {
  readonly banId: EntityId;
  readonly mode: Ban["mode"];
}

/** Hot-path ban lookups (every socket connect and queue join), kept in sync with the repository. */
export interface BanCache {
  store(ban: Ban, now: Date): Promise<void>;
  remove(ban: Ban): Promise<void>;
  lookup(targets: readonly BanTarget[], now: Date): Promise<CachedBan[]>;
}

/** Disconnects everyone a full ban covers, wherever they are connected, and tells them why. */
export interface BanEnforcer {
  enforce(targets: readonly BanTarget[]): Promise<void>;
}

/** Tells connected people about a moderator warning (they keep chatting). */
export interface ModerationNotifier {
  warn(targets: readonly BanTarget[], message: string): Promise<void>;
}

export interface TrustStore {
  /** The lowest score among the keys (account and device). Unknown keys have the default score. */
  scoreOf(keys: readonly string[]): Promise<number>;
  adjust(keys: readonly string[], delta: number, effectId?: string): Promise<void>;
}

export interface EvidenceMessage {
  readonly from: "reporter" | "reported";
  readonly text: string;
  readonly sentAt: Date;
}

export interface Evidence {
  readonly id: EntityId;
  readonly reportId: EntityId;
  readonly snapshot: { readonly contentType: "image/jpeg"; readonly data: Buffer } | null;
  readonly messages: readonly EvidenceMessage[];
  readonly createdAt: Date;
  /** Deleted automatically after this (retention policy). */
  readonly expiresAt: Date;
}

export interface EvidenceStore {
  save(evidence: Evidence): Promise<void>;
  get(id: EntityId): Promise<Evidence | null>;
}

/** Pluggable content scoring for the moderation pipeline. Scores are 0..1. */
export interface ContentClassifier {
  classify(input: { readonly image: Buffer | null; readonly texts: readonly string[] }): Promise<ReportScore>;
}

export interface AuditActor {
  readonly kind: "staff" | "system";
  readonly subjectId: EntityId | null;
  readonly roles: readonly Role[];
}

export const SYSTEM_ACTOR: AuditActor = { kind: "system", subjectId: null, roles: [] };

export interface AuditEntry {
  /** Set for entries derived from events, so a redelivered event writes the entry only once. */
  readonly id?: string;
  readonly actor: AuditActor;
  readonly action: string;
  readonly target: { readonly type: string; readonly id: string };
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly at: Date;
}

/** Append-only record of staff and automatic actions. */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export interface TextRulesProvider {
  current(): Promise<TextRules>;
}

/** Editable rules; saving takes effect everywhere within the providers' refresh interval. */
export interface TextRulesRepository extends TextRulesProvider {
  save(rules: TextRules): Promise<void>;
}

/** Counts events per key in a sliding window (e.g. content flags per device). */
export interface EventCounter {
  /** Records one event and returns how many happened within the window, including this one. */
  increment(key: string, windowMs: number): Promise<number>;
}
