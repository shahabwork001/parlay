/** Mirrors the backend's REPORT_CATEGORIES; order is the order shown in the report dialog. */
export const REPORT_CATEGORIES = [
  { value: "nudity", label: "Nudity or sexual acts on camera" },
  { value: "sexual-content", label: "Sexual messages or requests" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech or slurs" },
  { value: "violence", label: "Threats or violence" },
  { value: "self-harm", label: "Self-harm or suicide" },
  { value: "scam", label: "Scam, fraud or advertising" },
  { value: "spam", label: "Spam or bot" },
  { value: "appears-minor", label: "Appears to be under 18" },
  { value: "child-sexual-content", label: "Sexual content involving a minor" },
  { value: "other", label: "Something else" },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["value"];

export const isMinorSafety = (category: ReportCategory) =>
  category === "appears-minor" || category === "child-sexual-content";

const LABELS = new Map<string, string>(
  REPORT_CATEGORIES.map((option) => [option.value, option.label]),
);

export const categoryLabel = (value: string): string => LABELS.get(value) ?? value;
