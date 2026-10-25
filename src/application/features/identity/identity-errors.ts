import { AppErrors } from "../../../domain/common/app-error.js";

/** Stable error codes for identity flows. Messages are safe to show to users. */
export const IdentityErrors = {
  termsOutdated: AppErrors.validation(
    "terms.outdated",
    "The Terms have changed. Review and accept the current version to continue.",
  ),
  invalidCredentials: AppErrors.unauthorized("auth.invalid_credentials", "Email or password is incorrect."),
  accountLocked: AppErrors.rateLimited(
    "auth.locked",
    "Too many failed sign-in attempts. Try again in a few minutes.",
  ),
  emailNotVerified: AppErrors.forbidden(
    "auth.email_not_verified",
    "Verify your email address before signing in. Check your inbox for the link.",
  ),
  twoFactorRequired: AppErrors.unauthorized(
    "auth.two_factor_required",
    "Enter the code from your authenticator app.",
  ),
  invalidTwoFactor: AppErrors.unauthorized("auth.invalid_two_factor", "That code is not valid."),
  sessionExpired: AppErrors.unauthorized("auth.session_expired", "Your session has expired. Sign in again."),
  invalidToken: AppErrors.validation("auth.invalid_token", "This link is invalid or has expired."),
  accountsOnly: AppErrors.forbidden("auth.account_required", "Sign in to an account to do this."),
  notFound: AppErrors.notFound("auth.account_not_found", "The account no longer exists."),
  concurrentUpdate: AppErrors.conflict(
    "auth.concurrent_update",
    "Your account changed meanwhile. Try again.",
  ),
} as const;
