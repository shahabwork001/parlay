import { AggregateRoot } from "../common/aggregate-root.js";
import { type EntityId, newEntityId } from "../common/entity.js";

export const REPORT_CATEGORIES = [
  "nudity",
  "sexual-content",
  "harassment",
  "hate",
  "violence",
  "self-harm",
  "scam",
  "spam",
  "appears-minor",
  "child-sexual-content",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Categories that trigger the minor-safety workflow: top priority, suspension, evidence hold. */
export const MINOR_SAFETY_CATEGORIES: readonly ReportCategory[] = ["appears-minor", "child-sexual-content"];

export const isMinorSafetyCategory = (category: ReportCategory): boolean =>
  MINOR_SAFETY_CATEGORIES.includes(category);

export type ReportStatus = "pending-review" | "dismissed" | "actioned";
export type PriorityTier = "critical" | "high" | "normal" | "low";

/** Escalation to an outside authority (e.g. NCMEC CyberTipline), tracked for minor-safety reports. */
export type EscalationStatus = "required" | "reported" | "not-required";

/** What a moderator decided. `warned` and `banned` uphold the report; `dismissed` rejects it. */
export const REPORT_OUTCOMES = ["dismissed", "warned", "banned"] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

export interface ReportResolution {
  readonly outcome: ReportOutcome;
  readonly by: EntityId;
  readonly at: Date;
  readonly note: string | null;
}

export type ReportError = "report.already_resolved" | "report.escalation_not_applicable";

/** A participant as the moderation side sees them. Network values are keyed hashes, never raw IPs. */
export interface ReportParty {
  readonly subjectId: EntityId;
  readonly deviceId: EntityId;
  readonly kind: "user" | "anonymous";
  readonly networkHash: string;
  readonly subnetHash: string;
}

export interface ReportScore {
  /** 0..1 from the content classifier, null when there was nothing to classify. */
  readonly image: number | null;
  readonly text: number | null;
  readonly labels: readonly string[];
}

export interface ReportState {
  readonly id: EntityId;
  readonly version: number;
  readonly sessionId: string;
  readonly mode: "text" | "video";
  readonly category: ReportCategory;
  readonly note: string | null;
  readonly reporter: ReportParty;
  readonly reported: ReportParty;
  readonly evidenceId: EntityId | null;
  readonly status: ReportStatus;
  readonly priority: number;
  readonly tier: PriorityTier;
  readonly score: ReportScore | null;
  readonly escalation: EscalationStatus | null;
  /** Authority reference (e.g. a CyberTipline report number) once escalated. */
  readonly escalationReference: string | null;
  readonly resolution: ReportResolution | null;
  readonly createdAt: Date;
  readonly scoredAt: Date | null;
  readonly resolvedAt: Date | null;
}

export interface NewReport {
  readonly sessionId: string;
  readonly mode: "text" | "video";
  readonly category: ReportCategory;
  readonly note: string | null;
  readonly reporter: ReportParty;
  readonly reported: ReportParty;
  readonly evidenceId: EntityId | null;
}

/** Inputs to report prioritisation. Trust scores are 0..100. */
export interface PriorityFactors {
  readonly category: ReportCategory;
  readonly classifierScore: number | null;
  readonly reporterTrust: number;
  readonly reportedTrust: number;
  /** Other reports against the same person in the last 24 hours. */
  readonly recentReportsAgainst: number;
}

const CATEGORY_BASE: Record<ReportCategory, number> = {
  "child-sexual-content": 100,
  "appears-minor": 95,
  "self-harm": 65,
  nudity: 60,
  "sexual-content": 60,
  violence: 60,
  hate: 55,
  harassment: 45,
  scam: 40,
  spam: 30,
  other: 25,
};

/**
 * Orders the human review queue (0..100). Category sets the base; classifier evidence, the reported
 * person's low trust and repeated reports raise it; reports from low-trust reporters weigh less.
 * Minor-safety reports are always critical.
 */
export function reportPriority(factors: PriorityFactors): { priority: number; tier: PriorityTier } {
  if (isMinorSafetyCategory(factors.category)) return { priority: 100, tier: "critical" };

  let priority = CATEGORY_BASE[factors.category];
  priority += (factors.classifierScore ?? 0) * 20;
  priority += Math.max(0, 50 - factors.reportedTrust) / 5;
  priority += Math.min(factors.recentReportsAgainst, 5) * 4;
  if (factors.reporterTrust < 25) priority -= 10;
  priority = Math.round(Math.min(99, Math.max(0, priority)));

  const tier: PriorityTier =
    priority >= 90 ? "critical" : priority >= 60 ? "high" : priority >= 35 ? "normal" : "low";
  return { priority, tier };
}

/** A user's report about a chat partner, from submission through scoring to a moderator decision. */
export class Report extends AggregateRoot {
  readonly sessionId: string;
  readonly mode: "text" | "video";
  readonly category: ReportCategory;
  readonly note: string | null;
  readonly reporter: ReportParty;
  readonly reported: ReportParty;
  readonly evidenceId: EntityId | null;
  readonly createdAt: Date;
  #status: ReportStatus;
  #priority: number;
  #tier: PriorityTier;
  #score: ReportScore | null;
  #escalation: EscalationStatus | null;
  #escalationReference: string | null;
  #resolution: ReportResolution | null;
  #scoredAt: Date | null;
  #resolvedAt: Date | null;

  private constructor(state: ReportState) {
    super(state.id, state.version);
    this.sessionId = state.sessionId;
    this.mode = state.mode;
    this.category = state.category;
    this.note = state.note;
    this.reporter = state.reporter;
    this.reported = state.reported;
    this.evidenceId = state.evidenceId;
    this.createdAt = state.createdAt;
    this.#status = state.status;
    this.#priority = state.priority;
    this.#tier = state.tier;
    this.#score = state.score;
    this.#escalation = state.escalation;
    this.#escalationReference = state.escalationReference;
    this.#resolution = state.resolution;
    this.#scoredAt = state.scoredAt;
    this.#resolvedAt = state.resolvedAt;
  }

  /** Initial priority comes from the category alone; scoring refines it once the worker runs. */
  static submit(report: NewReport, now: Date): Report {
    const minorSafety = isMinorSafetyCategory(report.category);
    const initial = reportPriority({
      category: report.category,
      classifierScore: null,
      reporterTrust: 50,
      reportedTrust: 50,
      recentReportsAgainst: 0,
    });
    return new Report({
      ...report,
      id: newEntityId(),
      version: 0,
      status: "pending-review",
      priority: initial.priority,
      tier: initial.tier,
      score: null,
      escalation: minorSafety ? "required" : null,
      escalationReference: null,
      resolution: null,
      createdAt: now,
      scoredAt: null,
      resolvedAt: null,
    });
  }

  static restore(state: ReportState): Report {
    return new Report(state);
  }

  get isMinorSafety(): boolean {
    return isMinorSafetyCategory(this.category);
  }

  get status(): ReportStatus {
    return this.#status;
  }

  get priority(): number {
    return this.#priority;
  }

  get tier(): PriorityTier {
    return this.#tier;
  }

  get score(): ReportScore | null {
    return this.#score;
  }

  get escalation(): EscalationStatus | null {
    return this.#escalation;
  }

  get scoredAt(): Date | null {
    return this.#scoredAt;
  }

  get resolvedAt(): Date | null {
    return this.#resolvedAt;
  }

  get resolution(): ReportResolution | null {
    return this.#resolution;
  }

  get escalationReference(): string | null {
    return this.#escalationReference;
  }

  /** Upheld means the reported person broke the rules (warned or banned). */
  get isUpheld(): boolean {
    return this.#resolution !== null && this.#resolution.outcome !== "dismissed";
  }

  resolve(outcome: ReportOutcome, by: EntityId, note: string | null, now: Date): ReportError | null {
    if (this.#resolution) return "report.already_resolved";
    this.#resolution = { outcome, by, at: now, note };
    this.#status = outcome === "dismissed" ? "dismissed" : "actioned";
    this.#resolvedAt = now;
    return null;
  }

  /** Records the outcome of the minor-safety escalation step. */
  recordEscalation(status: "reported" | "not-required", reference: string | null): ReportError | null {
    if (this.#escalation === null) return "report.escalation_not_applicable";
    this.#escalation = status;
    this.#escalationReference = status === "reported" ? reference : null;
    return null;
  }

  applyScore(
    score: ReportScore,
    factors: Omit<PriorityFactors, "category" | "classifierScore">,
    now: Date,
  ): void {
    const classifierScore = Math.max(score.image ?? 0, score.text ?? 0);
    const { priority, tier } = reportPriority({
      ...factors,
      category: this.category,
      classifierScore: score.image === null && score.text === null ? null : classifierScore,
    });
    this.#score = score;
    this.#priority = priority;
    this.#tier = tier;
    this.#scoredAt = now;
  }
}
