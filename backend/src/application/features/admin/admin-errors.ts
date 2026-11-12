import { AppErrors } from "../../../domain/common/app-error.js";

export const AdminErrors = {
  reportNotFound: AppErrors.notFound("report.not_found", "Report not found."),
  alreadyResolved: AppErrors.conflict("report.already_resolved", "This report was already decided."),
  escalationNotApplicable: AppErrors.conflict(
    "report.escalation_not_applicable",
    "Only minor-safety reports have an escalation step.",
  ),
  referenceRequired: AppErrors.validation(
    "report.reference_required",
    "Enter the reference number the authority gave you.",
  ),
  escalationPermission: AppErrors.forbidden(
    "report.escalation_restricted",
    "Minor-safety reports can only be decided by staff who can escalate.",
  ),
  banNotFound: AppErrors.notFound("ban.not_found", "Ban not found."),
  noBanTargets: AppErrors.validation(
    "ban.no_targets",
    "Choose an account, a device or an IP address to ban.",
  ),
  banNotActive: AppErrors.conflict("ban.not_active", "This ban is no longer active."),
  noPendingAppeal: AppErrors.conflict("ban.no_pending_appeal", "There is no pending appeal on this ban."),
  userNotFound: AppErrors.notFound("user.not_found", "No account with that email or id."),
  emailNotVerified: AppErrors.conflict(
    "staff.email_not_verified",
    "The account must confirm its email address before it can become staff.",
  ),
  lastSuperAdmin: AppErrors.conflict(
    "staff.last_super_admin",
    "Parley needs at least one SuperAdmin. Promote someone else first.",
  ),
  cannotChangeSelf: AppErrors.forbidden("staff.self", "You cannot change your own roles."),
  concurrentChange: AppErrors.conflict(
    "admin.concurrent_change",
    "Someone else changed this at the same time. Reload and try again.",
  ),
} as const;
