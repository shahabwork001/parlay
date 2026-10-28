import { AggregateRoot } from "../common/aggregate-root.js";
import { type EntityId, newEntityId } from "../common/entity.js";

/**
 * What a ban applies to. Accounts and devices by id (a device id stands for its fingerprint hash);
 * networks by keyed hash of the IP address or of its /24 (IPv4) or /64 (IPv6) subnet.
 */
export const BAN_TARGET_KINDS = ["account", "device", "ip", "subnet"] as const;
export type BanTargetKind = (typeof BAN_TARGET_KINDS)[number];

export interface BanTarget {
  readonly kind: BanTargetKind;
  readonly value: string;
}

/** `full` blocks chat; `shadow` lets the person chat, but only with other shadow-banned people. */
export type BanMode = "full" | "shadow";

export const BAN_REASONS = [
  "pending-review",
  "nudity",
  "sexual-content",
  "harassment",
  "hate",
  "violence",
  "spam",
  "scam",
  "minor-safety",
  "underage",
  "repeated-flags",
  "repeated-reports",
  "other",
] as const;
export type BanReason = (typeof BAN_REASONS)[number];

export type BanSource = "moderator" | "automatic";

export type AppealStatus = "pending" | "accepted" | "rejected";

export interface Appeal {
  readonly message: string;
  readonly submittedAt: Date;
  readonly status: AppealStatus;
  readonly decidedAt: Date | null;
}

export interface BanState {
  readonly id: EntityId;
  readonly version: number;
  readonly targets: readonly BanTarget[];
  readonly mode: BanMode;
  readonly reason: BanReason;
  /** Shown to the banned person; moderators may add detail. */
  readonly message: string | null;
  readonly source: BanSource;
  readonly createdBy: EntityId | null;
  readonly reportId: EntityId | null;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly liftedAt: Date | null;
  readonly liftedBy: EntityId | null;
  readonly appeal: Appeal | null;
}

export interface NewBan {
  readonly targets: readonly BanTarget[];
  readonly mode: BanMode;
  readonly reason: BanReason;
  readonly message?: string | null;
  readonly source: BanSource;
  readonly createdBy?: EntityId | null;
  readonly reportId?: EntityId | null;
  /** Omit for a permanent ban (or a suspension that lasts until review). */
  readonly durationMs?: number | null;
}

export type BanError = "ban.not_active" | "ban.appeal_exists" | "ban.not_appealable";

export const targetKey = (target: BanTarget): string => `${target.kind}:${target.value}`;

export class Ban extends AggregateRoot {
  readonly targets: readonly BanTarget[];
  readonly mode: BanMode;
  readonly reason: BanReason;
  readonly message: string | null;
  readonly source: BanSource;
  readonly createdBy: EntityId | null;
  readonly reportId: EntityId | null;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  #liftedAt: Date | null;
  #liftedBy: EntityId | null;
  #appeal: Appeal | null;

  private constructor(state: BanState) {
    super(state.id, state.version);
    this.targets = state.targets;
    this.mode = state.mode;
    this.reason = state.reason;
    this.message = state.message;
    this.source = state.source;
    this.createdBy = state.createdBy;
    this.reportId = state.reportId;
    this.createdAt = state.createdAt;
    this.expiresAt = state.expiresAt;
    this.#liftedAt = state.liftedAt;
    this.#liftedBy = state.liftedBy;
    this.#appeal = state.appeal;
  }

  static issue(ban: NewBan, now: Date): Ban {
    if (ban.targets.length === 0) throw new Error("A ban needs at least one target.");
    const durationMs = ban.durationMs ?? null;
    return new Ban({
      id: newEntityId(),
      version: 0,
      targets: dedupe(ban.targets),
      mode: ban.mode,
      reason: ban.reason,
      message: ban.message ?? null,
      source: ban.source,
      createdBy: ban.createdBy ?? null,
      reportId: ban.reportId ?? null,
      createdAt: now,
      expiresAt: durationMs === null ? null : new Date(now.getTime() + durationMs),
      liftedAt: null,
      liftedBy: null,
      appeal: null,
    });
  }

  static restore(state: BanState): Ban {
    return new Ban(state);
  }

  get liftedAt(): Date | null {
    return this.#liftedAt;
  }

  get liftedBy(): EntityId | null {
    return this.#liftedBy;
  }

  get appeal(): Appeal | null {
    return this.#appeal;
  }

  get isPermanent(): boolean {
    return this.expiresAt === null;
  }

  isActive(now: Date): boolean {
    return this.#liftedAt === null && (this.expiresAt === null || this.expiresAt > now);
  }

  /** Shadow bans are invisible to the person, so they cannot be appealed. */
  get isAppealable(): boolean {
    return this.mode === "full";
  }

  submitAppeal(message: string, now: Date): BanError | null {
    if (!this.isActive(now)) return "ban.not_active";
    if (!this.isAppealable) return "ban.not_appealable";
    if (this.#appeal) return "ban.appeal_exists";
    this.#appeal = { message, submittedAt: now, status: "pending", decidedAt: null };
    return null;
  }

  lift(by: EntityId | null, now: Date): BanError | null {
    if (!this.isActive(now)) return "ban.not_active";
    this.#liftedAt = now;
    this.#liftedBy = by;
    return null;
  }

  /** Remaining lifetime in milliseconds, or null when permanent. */
  remainingMs(now: Date): number | null {
    return this.expiresAt === null ? null : Math.max(0, this.expiresAt.getTime() - now.getTime());
  }
}

function dedupe(targets: readonly BanTarget[]): BanTarget[] {
  const seen = new Map<string, BanTarget>();
  for (const target of targets) seen.set(targetKey(target), target);
  return [...seen.values()];
}
