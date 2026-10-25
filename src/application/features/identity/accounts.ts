import { fail, okVoid, type Result } from "../../../domain/common/result.js";
import { acceptTerms } from "../../../domain/identity/terms-acceptance.js";
import { normalizeEmail, User } from "../../../domain/identity/user.js";
import { UniqueConstraintViolationError } from "../../abstractions/persistence/errors.js";
import { EmailRequested } from "./events.js";
import type { IdentityContext } from "./identity-context.js";
import { IdentityErrors } from "./identity-errors.js";
import type { Principal } from "./ports.js";
import type { RegisterRequest, ResetPasswordRequest } from "./schemas.js";

const link = (context: IdentityContext, path: string, token: string) =>
  `${context.settings.frontendUrl}${path}?token=${encodeURIComponent(token)}`;

async function sendVerification(context: IdentityContext, user: User): Promise<void> {
  const token = await context.oneTimeTokens.create(
    "verify-email",
    user.id,
    context.settings.emailVerificationTtlMs,
  );
  await context.events.publish(EmailRequested, {
    to: user.email,
    template: "verify-email",
    link: link(context, "/verify-email", token),
  });
}

/**
 * Registration never reveals whether an email is taken: the response is identical, and an
 * existing account owner receives an "account exists" email instead of a verification link.
 */
export class RegisterUser {
  constructor(private readonly context: IdentityContext) {}

  async execute(request: RegisterRequest): Promise<Result<undefined>> {
    if (request.termsVersion !== this.context.settings.termsVersion)
      return fail(IdentityErrors.termsOutdated);

    const email = normalizeEmail(request.email);
    if (await this.context.users.findByEmail(email)) {
      await this.notifyExisting(email);
      return okVoid();
    }

    const now = this.context.clock();
    const passwordHash = await this.context.passwords.hash(request.password);
    const user = User.register(email, passwordHash, acceptTerms(request.termsVersion, now), now);
    try {
      await this.context.users.add(user);
    } catch (error) {
      if (!(error instanceof UniqueConstraintViolationError)) throw error;
      await this.notifyExisting(email);
      return okVoid();
    }

    await sendVerification(this.context, user);
    return okVoid();
  }

  private async notifyExisting(email: string): Promise<void> {
    await this.context.events.publish(EmailRequested, {
      to: email,
      template: "account-exists",
      link: `${this.context.settings.frontendUrl}/login`,
    });
  }
}

export class VerifyEmail {
  constructor(private readonly context: IdentityContext) {}

  async execute(token: string): Promise<Result<undefined>> {
    const userId = await this.context.oneTimeTokens.consume("verify-email", token);
    const user = userId ? await this.context.users.getById(userId) : null;
    if (!user) return fail(IdentityErrors.invalidToken);

    user.verifyEmail(this.context.clock());
    if (!(await this.context.users.update(user))) return fail(IdentityErrors.concurrentUpdate);
    return okVoid();
  }
}

export class ResendVerification {
  constructor(private readonly context: IdentityContext) {}

  async execute(principal: Principal): Promise<Result<undefined>> {
    if (principal.kind !== "user") return fail(IdentityErrors.accountsOnly);
    const user = await this.context.users.getById(principal.subjectId);
    if (!user) return fail(IdentityErrors.notFound);
    if (!user.isEmailVerified) await sendVerification(this.context, user);
    return okVoid();
  }
}

/** Always succeeds so the response never reveals whether an account exists. */
export class RequestPasswordReset {
  constructor(private readonly context: IdentityContext) {}

  async execute(email: string): Promise<Result<undefined>> {
    const user = await this.context.users.findByEmail(normalizeEmail(email));
    if (user?.isEmailVerified) {
      const token = await this.context.oneTimeTokens.create(
        "reset-password",
        user.id,
        this.context.settings.passwordResetTtlMs,
      );
      await this.context.events.publish(EmailRequested, {
        to: user.email,
        template: "password-reset",
        link: link(this.context, "/reset-password", token),
      });
    }
    return okVoid();
  }
}

/** Sets a new password and signs the account out everywhere. */
export class ResetPassword {
  constructor(private readonly context: IdentityContext) {}

  async execute(request: ResetPasswordRequest): Promise<Result<undefined>> {
    const userId = await this.context.oneTimeTokens.consume("reset-password", request.token);
    const user = userId ? await this.context.users.getById(userId) : null;
    if (!user) return fail(IdentityErrors.invalidToken);

    user.changePassword(await this.context.passwords.hash(request.password));
    if (!(await this.context.users.update(user))) return fail(IdentityErrors.concurrentUpdate);
    await this.context.refreshTokens.revokeAllForSubject(user.id);
    return okVoid();
  }
}
