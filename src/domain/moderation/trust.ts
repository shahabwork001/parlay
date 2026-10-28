/**
 * Trust score per account and per device, 0..100. Everyone starts at the default; valid reports and
 * content flags lower it, clean sessions raise it slowly. The lower of a person's account and device
 * scores applies, so a fresh account on a distrusted device is still distrusted.
 */
export const TRUST = {
  default: 50,
  min: 0,
  max: 100,
  /** Below this, people are matched with each other and get stricter screening. */
  lowThreshold: 25,
} as const;

export const TRUST_ADJUSTMENTS = {
  /** A session that lasted at least a minute and ended normally. */
  cleanSession: 1,
  /** A report was filed against this person (provisional; a moderator's decision weighs more). */
  reportReceived: -3,
  /** A moderator upheld a report. */
  reportUpheld: -15,
  /** The client-side screening flagged this person's own video. */
  contentFlag: -5,
  /** A message was rejected for slurs. */
  blockedMessage: -2,
} as const;

export type TrustTier = "standard" | "low";

export const clampTrust = (score: number): number => Math.min(TRUST.max, Math.max(TRUST.min, score));

export const trustTier = (score: number): TrustTier => (score < TRUST.lowThreshold ? "low" : "standard");

/** Trust keys: one per account and one per device (anonymous people only have a device). */
export const trustKeys = (identity: {
  readonly kind: "user" | "anonymous";
  readonly subjectId: string;
  readonly deviceId: string;
}) =>
  identity.kind === "user"
    ? [`user:${identity.subjectId}`, `device:${identity.deviceId}`]
    : [`device:${identity.deviceId}`];
