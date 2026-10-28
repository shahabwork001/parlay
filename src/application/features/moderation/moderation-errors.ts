import { AppErrors } from "../../../domain/common/app-error.js";

export const ModerationErrors = {
  sessionNotFound: AppErrors.notFound(
    "report.session_not_found",
    "That chat can no longer be reported. Reports are possible for 10 minutes after a chat ends.",
  ),
  alreadyReported: AppErrors.conflict("report.duplicate", "You already reported this chat."),
  tooManyReports: AppErrors.rateLimited(
    "report.rate_limited",
    "You have sent many reports. Try again later.",
  ),
  invalidSnapshot: AppErrors.validation("report.invalid_snapshot", "The attached image is not a valid JPEG."),
  reportNotFound: AppErrors.notFound("report.not_found", "Report not found."),
  evidenceExpired: AppErrors.notFound("evidence.not_found", "The evidence for this report has expired."),
  escalationRequired: AppErrors.forbidden(
    "evidence.restricted",
    "Minor-safety evidence is restricted to staff who can escalate.",
  ),
  noActiveBan: AppErrors.notFound("ban.not_found", "There is no active ban on this account or device."),
  appealExists: AppErrors.conflict("ban.appeal_exists", "You already appealed this ban."),
  notAppealable: AppErrors.conflict("ban.not_appealable", "This ban cannot be appealed."),
} as const;
