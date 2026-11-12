/** Moderation thresholds. Configuration today; admin-editable site configuration in Phase 7. */
export interface ModerationPolicy {
  readonly evidenceRetentionDays: number;
  /** Minor-safety evidence is preserved longer (legal preservation duties). */
  readonly minorSafetyRetentionDays: number;
  /** Client content flags within the window that trigger an automatic temporary ban. */
  readonly flagBanThreshold: number;
  readonly flagWindowMs: number;
  /** Different people reporting someone within the window suspends them pending review. */
  readonly reportSuspensionThreshold: number;
  readonly reportSuspensionWindowMs: number;
  readonly automaticBanMs: number;
  readonly reportsPerHour: number;
  /** Client-side screening thresholds (0..1); stricter for low-trust and shadow pools. */
  readonly nsfwThreshold: { readonly standard: number; readonly strict: number };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const DAY_MS = 24 * HOUR;

export const defaultModerationPolicy = (
  overrides: Partial<Pick<ModerationPolicy, "evidenceRetentionDays" | "minorSafetyRetentionDays">> = {},
): ModerationPolicy => ({
  evidenceRetentionDays: 30,
  minorSafetyRetentionDays: 365,
  flagBanThreshold: 3,
  flagWindowMs: 10 * MINUTE,
  reportSuspensionThreshold: 3,
  reportSuspensionWindowMs: HOUR,
  automaticBanMs: DAY_MS,
  reportsPerHour: 10,
  nsfwThreshold: { standard: 0.75, strict: 0.55 },
  ...overrides,
});
