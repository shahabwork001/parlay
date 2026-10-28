import type { User } from "../../../domain/identity/user.js";
import type { Ban } from "../../../domain/moderation/ban.js";
import type { Report, ReportParty } from "../../../domain/moderation/report.js";

/*
 * Response shapes of the admin API. Aggregates are mapped field by field so private state (password
 * hashes, TOTP secrets, network hashes) never reaches a response by accident.
 */

const toParty = (party: ReportParty) => ({
  subjectId: party.subjectId,
  deviceId: party.deviceId,
  kind: party.kind,
});

export const toReportView = (report: Report) => ({
  id: report.id,
  sessionId: report.sessionId,
  mode: report.mode,
  category: report.category,
  note: report.note,
  reporter: toParty(report.reporter),
  reported: toParty(report.reported),
  hasEvidence: report.evidenceId !== null,
  status: report.status,
  priority: report.priority,
  tier: report.tier,
  score: report.score,
  escalation: report.escalation,
  escalationReference: report.escalationReference,
  resolution: report.resolution,
  createdAt: report.createdAt,
  scoredAt: report.scoredAt,
  resolvedAt: report.resolvedAt,
});

export const toBanView = (ban: Ban) => ({
  id: ban.id,
  targets: ban.targets,
  mode: ban.mode,
  reason: ban.reason,
  message: ban.message,
  source: ban.source,
  createdBy: ban.createdBy,
  reportId: ban.reportId,
  createdAt: ban.createdAt,
  expiresAt: ban.expiresAt,
  liftedAt: ban.liftedAt,
  appeal: ban.appeal,
});

export const toUserView = (user: User) => ({
  id: user.id,
  email: user.email,
  roles: user.roles,
  emailVerified: user.isEmailVerified,
  twoFactorEnabled: user.isTwoFactorEnabled,
  lockedUntil: user.lockedUntil,
  createdAt: user.createdAt,
});
