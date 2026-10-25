import { newEntityId } from "../../../domain/common/entity.js";
import { Device } from "../../../domain/identity/device.js";
import type { User } from "../../../domain/identity/user.js";
import type { IdentityContext } from "./identity-context.js";
import type { IssuedToken, Principal } from "./ports.js";

export interface AuthSession {
  readonly principal: Principal;
  readonly accessToken: IssuedToken;
  readonly refreshToken: IssuedToken;
}

export const principalForUser = (user: User, deviceId: string, mfa: boolean): Principal => ({
  kind: "user",
  subjectId: user.id,
  deviceId,
  roles: user.roles,
  emailVerified: user.isEmailVerified,
  mfa,
  termsVersion: user.termsAcceptance?.version ?? null,
});

export const principalForDevice = (device: Device): Principal => ({
  kind: "anonymous",
  subjectId: device.id,
  deviceId: device.id,
  roles: [],
  emailVerified: false,
  mfa: false,
  termsVersion: device.termsAcceptance?.version ?? null,
});

/** Issues an access token and a refresh token in a new (or the given) refresh family. */
export async function issueSession(
  context: IdentityContext,
  principal: Principal,
  familyId: string = newEntityId(),
): Promise<AuthSession> {
  const [accessToken, refreshToken] = await Promise.all([
    context.accessTokens.issue(principal),
    context.refreshTokens.issue({
      familyId,
      subject: { kind: principal.kind, id: principal.subjectId },
      deviceId: principal.deviceId,
      mfa: principal.mfa,
    }),
  ]);
  return { principal, accessToken, refreshToken };
}

/** Finds the device for a client fingerprint (stored only as a keyed hash), registering it on first sight. */
export async function resolveDevice(context: IdentityContext, fingerprint: string): Promise<Device> {
  const fingerprintHash = context.hasher.hash("device", fingerprint);
  const now = context.clock();
  const existing = await context.devices.findByFingerprintHash(fingerprintHash);
  if (existing) {
    existing.seen(now);
    await context.devices.update(existing);
    return existing;
  }

  const device = Device.register(fingerprintHash, now);
  try {
    await context.devices.add(device);
    return device;
  } catch (error) {
    const raced = await context.devices.findByFingerprintHash(fingerprintHash);
    if (raced) return raced;
    throw error;
  }
}
