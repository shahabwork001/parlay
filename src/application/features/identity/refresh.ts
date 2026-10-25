import { fail, ok, type Result } from "../../../domain/common/result.js";
import type { IdentityContext } from "./identity-context.js";
import { IdentityErrors } from "./identity-errors.js";
import type { Principal, RefreshSession } from "./ports.js";
import { type AuthSession, principalForDevice, principalForUser } from "./sessions.js";

/**
 * Rotates the refresh token and re-reads the subject so role changes, locks and terms updates take
 * effect on the next refresh. A reused token revokes its whole family (theft detection).
 */
export class RefreshAuthSession {
  constructor(private readonly context: IdentityContext) {}

  async execute(refreshToken: string): Promise<Result<AuthSession>> {
    const rotation = await this.context.refreshTokens.rotate(refreshToken);
    if (rotation.status !== "rotated") return fail(IdentityErrors.sessionExpired);

    const principal = await this.loadPrincipal(rotation.session);
    if (!principal) {
      await this.context.refreshTokens.revokeByToken(rotation.refreshToken.token);
      return fail(IdentityErrors.sessionExpired);
    }

    const accessToken = await this.context.accessTokens.issue(principal);
    return ok({ principal, accessToken, refreshToken: rotation.refreshToken });
  }

  private async loadPrincipal(session: RefreshSession): Promise<Principal | null> {
    if (session.subject.kind === "anonymous") {
      const device = await this.context.devices.getById(session.subject.id);
      return device ? principalForDevice(device) : null;
    }
    const user = await this.context.users.getById(session.subject.id);
    if (!user || user.isLocked(this.context.clock())) return null;
    return principalForUser(user, session.deviceId, session.mfa);
  }
}

export class Logout {
  constructor(private readonly context: IdentityContext) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.context.refreshTokens.revokeByToken(refreshToken);
  }
}
