import { fail, ok, type Result } from "../../../domain/common/result.js";
import { acceptTerms } from "../../../domain/identity/terms-acceptance.js";
import type { IdentityContext } from "./identity-context.js";
import { IdentityErrors } from "./identity-errors.js";
import type { AnonymousSessionRequest } from "./schemas.js";
import { type AuthSession, issueSession, principalForDevice, resolveDevice } from "./sessions.js";

/** Starts an account-less session bound to the caller's device, after the 18+ and Terms gate. */
export class CreateAnonymousSession {
  constructor(private readonly context: IdentityContext) {}

  async execute(request: AnonymousSessionRequest): Promise<Result<AuthSession>> {
    if (request.termsVersion !== this.context.settings.termsVersion)
      return fail(IdentityErrors.termsOutdated);

    const device = await resolveDevice(this.context, request.deviceFingerprint);
    device.recordAcceptance(acceptTerms(request.termsVersion, this.context.clock()));
    await this.context.devices.update(device);

    return ok(await issueSession(this.context, principalForDevice(device)));
  }
}
