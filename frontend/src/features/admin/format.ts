import type { AdminBan, Tier } from "@/repositories/admin-repository";

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

/** "5 minutes ago", "in 3 days". */
export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return relative.format(seconds, "second");
}

export function formatWait(ms: number | null): string {
  if (ms === null) return "No matches yet";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export const TIER_LABELS: Record<Tier, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export const BAN_REASON_LABELS: Record<AdminBan["reason"], string> = {
  "pending-review": "Pending review",
  nudity: "Nudity",
  "sexual-content": "Sexual content",
  harassment: "Harassment",
  hate: "Hate speech",
  violence: "Violence",
  spam: "Spam",
  scam: "Scam",
  "minor-safety": "Minor safety",
  underage: "Under 18",
  "repeated-flags": "Repeated screening flags",
  "repeated-reports": "Repeated reports",
  other: "Other",
};

export function banStatus(ban: AdminBan, now = Date.now()): "active" | "lifted" | "expired" {
  if (ban.liftedAt) return "lifted";
  if (ban.expiresAt && new Date(ban.expiresAt).getTime() <= now) return "expired";
  return "active";
}

export function banDuration(ban: AdminBan): string {
  if (ban.expiresAt === null) return ban.reason === "pending-review" ? "Until review" : "Permanent";
  return `Until ${formatDateTime(ban.expiresAt)}`;
}

/** Hashed and long ids are shortened for tables; the full value stays in the title attribute. */
export const shortId = (value: string): string =>
  value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
