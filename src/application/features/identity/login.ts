import { fail, ok, type Result } from "../../../domain/common/result.js";
import { normalizeEmail, type User } from "../../../domain/identity/user.js";
import type { IdentityContext } from "./identity-context.js";
import { IdentityErrors } from "./identity-errors.js";
import type { LoginRequest } from "./schemas.js";
import { type AuthSession, issueSession, principalForUser, resolveDevice } from "./sessions.js";

/**
 * Password sign-in with lockout and optional second factor. Unknown emails still pay the cost of a
 * password verification so response timing does not reveal which accounts exist.
 */
export class Login {
  readonly #timingDummyHash: Promise<string>;

  constructor(private readonly context: IdentityContext) {
    this.#timingDummyHash = context.passwords.hash("timing-equalisation-password");
  }

  async execute(request: LoginRequest): Promise<Result<AuthSession>> {
    const now = this.context.clock();
    const user = await this.context.users.findByEmail(normalizeEmail(request.email));
    if (!user) {
      await this.context.passwords.verify(await this.#timingDummyHash, request.password);
      return fail(IdentityErrors.invalidCredentials);
    }
    if (user.isLocked(now)) return fail(IdentityErrors.accountLocked);

    if (!(await this.context.passwords.verify(user.passwordHash, request.password))) {
      return this.failAttempt(user, IdentityErrors.invalidCredentials);
    }
    if (!user.isEmailVerified) return fail(IdentityErrors.emailNotVerified);

    if (user.isTwoFactorEnabled) {
      if (!request.totpCode && !request.recoveryCode) return fail(IdentityErrors.twoFactorRequired);
      if (!this.passesSecondFactor(user, request))
        return this.failAttempt(user, IdentityErrors.invalidTwoFactor);
    }

    user.recordSuccessfulLogin();
    if (!(await this.context.users.update(user))) return fail(IdentityErrors.concurrentUpdate);

    const device = await resolveDevice(this.context, request.deviceFingerprint);
    return ok(await issueSession(this.context, principalForUser(user, device.id, user.isTwoFactorEnabled)));
  }

  private passesSecondFactor(user: User, request: LoginRequest): boolean {
    if (request.totpCode) {
      const secret = this.context.cipher.decrypt(user.twoFactor?.encryptedSecret ?? "");
      return this.context.totp.verify(secret, request.totpCode);
    }
    return (
      request.recoveryCode !== undefined &&
      user.useRecoveryCode(this.context.hasher.hash("recovery-code", request.recoveryCode))
    );
  }

  private async failAttempt(user: User, error: typeof IdentityErrors.invalidCredentials) {
    user.recordFailedLogin(this.context.clock(), this.context.settings.lockout);
    await this.context.users.update(user);
    return fail(error);
  }
}
