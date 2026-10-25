import { fail, ok, type Result } from "../../../domain/common/result.js";
import { permissionsFor, type Permission, type Role } from "../../../domain/identity/roles.js";
import { acceptTerms, isCurrentAcceptance } from "../../../domain/identity/terms-acceptance.js";
import type { IdentityContext } from "./identity-context.js";
import { IdentityErrors } from "./identity-errors.js";
import type { IssuedToken, Principal } from "./ports.js";
import type { AcceptTermsRequest } from "./schemas.js";
import { type AuthSession, issueSession, principalForUser } from "./sessions.js";

export interface CurrentAccount {
  readonly kind: Principal["kind"];
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly roles: readonly Role[];
  readonly permissions: readonly Permission[];
  readonly mfa: boolean;
  readonly twoFactorEnabled: boolean;
  readonly termsVersion: string | null;
  readonly termsCurrent: boolean;
  readonly currentTermsVersion: string;
}

export class GetCurrentAccount {
  constructor(private readonly context: IdentityContext) {}

  async execute(principal: Principal): Promise<Result<CurrentAccount>> {
    const currentTermsVersion = this.context.settings.termsVersion;
    if (principal.kind === "anonymous") {
      const device = await this.context.devices.getById(principal.subjectId);
      if (!device) return fail(IdentityErrors.notFound);
      return ok({
        kind: "anonymous",
        email: null,
        emailVerified: false,
        roles: [],
        permissions: [],
        mfa: false,
        twoFactorEnabled: false,
        termsVersion: device.termsAcceptance?.version ?? null,
        termsCurrent: isCurrentAcceptance(device.termsAcceptance, currentTermsVersion),
        currentTermsVersion,
      });
    }

    const user = await this.context.users.getById(principal.subjectId);
    if (!user) return fail(IdentityErrors.notFound);
    return ok({
      kind: "user",
      email: user.email,
      emailVerified: user.isEmailVerified,
      roles: user.roles,
      permissions: [...permissionsFor(user.roles)],
      mfa: principal.mfa,
      twoFactorEnabled: user.isTwoFactorEnabled,
      termsVersion: user.termsAcceptance?.version ?? null,
      termsCurrent: isCurrentAcceptance(user.termsAcceptance, currentTermsVersion),
      currentTermsVersion,
    });
  }
}

/** Records acceptance of the current Terms and returns an access token reflecting it. */
export class AcceptCurrentTerms {
  constructor(private readonly context: IdentityContext) {}

  async execute(principal: Principal, request: AcceptTermsRequest): Promise<Result<IssuedToken>> {
    if (request.termsVersion !== this.context.settings.termsVersion)
      return fail(IdentityErrors.termsOutdated);
    const acceptance = acceptTerms(request.termsVersion, this.context.clock());

    if (principal.kind === "anonymous") {
      const device = await this.context.devices.getById(principal.subjectId);
      if (!device) return fail(IdentityErrors.notFound);
      device.recordAcceptance(acceptance);
      await this.context.devices.update(device);
    } else {
      const user = await this.context.users.getById(principal.subjectId);
      if (!user) return fail(IdentityErrors.notFound);
      user.recordAcceptance(acceptance);
      if (!(await this.context.users.update(user))) return fail(IdentityErrors.concurrentUpdate);
    }

    return ok(await this.context.accessTokens.issue({ ...principal, termsVersion: acceptance.version }));
  }
}

export interface TwoFactorSetup {
  readonly secret: string;
  readonly otpauthUri: string;
}

export class StartTwoFactorSetup {
  constructor(private readonly context: IdentityContext) {}

  async execute(principal: Principal): Promise<Result<TwoFactorSetup>> {
    if (principal.kind !== "user") return fail(IdentityErrors.accountsOnly);
    const user = await this.context.users.getById(principal.subjectId);
    if (!user) return fail(IdentityErrors.notFound);

    const secret = this.context.totp.generateSecret();
    const started = user.startTwoFactorEnrollment(this.context.cipher.encrypt(secret));
    if (!started.ok) return started;
    if (!(await this.context.users.update(user))) return fail(IdentityErrors.concurrentUpdate);

    return ok({ secret, otpauthUri: this.context.totp.buildUri(secret, user.email) });
  }
}

export interface TwoFactorEnabled {
  readonly recoveryCodes: readonly string[];
  readonly session: AuthSession;
}

/**
 * Confirms enrolment with a first valid code, issues single-use recovery codes, signs out every
 * other session and returns a fresh session that counts as multi-factor.
 */
export class ConfirmTwoFactorSetup {
  constructor(private readonly context: IdentityContext) {}

  async execute(principal: Principal, code: string): Promise<Result<TwoFactorEnabled>> {
    if (principal.kind !== "user") return fail(IdentityErrors.accountsOnly);
    const user = await this.context.users.getById(principal.subjectId);
    if (!user?.twoFactor) return fail(IdentityErrors.notFound);

    const secret = this.context.cipher.decrypt(user.twoFactor.encryptedSecret);
    if (!this.context.totp.verify(secret, code)) return fail(IdentityErrors.invalidTwoFactor);

    const recoveryCodes = this.context.totp.generateRecoveryCodes();
    const enabled = user.enableTwoFactor(
      recoveryCodes.map((recoveryCode) => this.context.hasher.hash("recovery-code", recoveryCode)),
      this.context.clock(),
    );
    if (!enabled.ok) return enabled;
    if (!(await this.context.users.update(user))) return fail(IdentityErrors.concurrentUpdate);

    await this.context.refreshTokens.revokeAllForSubject(user.id);
    const session = await issueSession(this.context, principalForUser(user, principal.deviceId, true));
    return ok({ recoveryCodes, session });
  }
}
