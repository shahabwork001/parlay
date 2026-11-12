import { beforeEach, describe, expect, it } from "vitest";
import {
  RegisterUser,
  RequestPasswordReset,
  ResendVerification,
  ResetPassword,
  VerifyEmail,
} from "../../../src/application/features/identity/accounts.js";
import {
  AcceptCurrentTerms,
  ConfirmTwoFactorSetup,
  GetCurrentAccount,
  StartTwoFactorSetup,
} from "../../../src/application/features/identity/account-settings.js";
import { CreateAnonymousSession } from "../../../src/application/features/identity/anonymous-session.js";
import { Login } from "../../../src/application/features/identity/login.js";
import type { Principal } from "../../../src/application/features/identity/ports.js";
import { Logout, RefreshAuthSession } from "../../../src/application/features/identity/refresh.js";
import { User } from "../../../src/domain/identity/user.js";
import {
  createTestIdentity,
  lastEmailToken,
  TEST_TERMS_VERSION,
  type TestIdentity,
  VALID_TOTP,
} from "../../support/identity-fakes.js";

const FINGERPRINT = "device-fingerprint-0001";
const EMAIL = "ada@example.com";
const PASSWORD = "correct horse battery";

const gate = { ageConfirmed: true as const, termsVersion: TEST_TERMS_VERSION };

async function registerVerified(identity: TestIdentity, email = EMAIL): Promise<User> {
  await new RegisterUser(identity).execute({ email, password: PASSWORD, ...gate });
  await new VerifyEmail(identity).execute(lastEmailToken(identity, email));
  return (await identity.users.findByEmail(email))!;
}

async function loginOk(identity: TestIdentity, extra: { totpCode?: string; recoveryCode?: string } = {}) {
  const result = await new Login(identity).execute({
    email: EMAIL,
    password: PASSWORD,
    deviceFingerprint: FINGERPRINT,
    ...extra,
  });
  if (!result.ok) throw new Error(`Login failed: ${result.error.code}`);
  return result.value;
}

describe("anonymous sessions", () => {
  let identity: TestIdentity;
  beforeEach(() => {
    identity = createTestIdentity();
  });

  it("creates a device-bound session after the terms gate", async () => {
    const result = await new CreateAnonymousSession(identity).execute({
      deviceFingerprint: FINGERPRINT,
      ...gate,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.principal).toMatchObject({
      kind: "anonymous",
      termsVersion: TEST_TERMS_VERSION,
      mfa: false,
    });
    const [device] = identity.devices.all();
    expect(device?.fingerprintHash).toBe(`device#${FINGERPRINT}`);
    expect(device?.termsAcceptance).toMatchObject({ version: TEST_TERMS_VERSION, ageConfirmed: true });
  });

  it("reuses the same device for the same fingerprint", async () => {
    const create = new CreateAnonymousSession(identity);
    await create.execute({ deviceFingerprint: FINGERPRINT, ...gate });
    await create.execute({ deviceFingerprint: FINGERPRINT, ...gate });

    expect(identity.devices.all()).toHaveLength(1);
  });

  it("rejects an outdated terms version", async () => {
    const result = await new CreateAnonymousSession(identity).execute({
      deviceFingerprint: FINGERPRINT,
      ageConfirmed: true,
      termsVersion: "2020-01-01",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "terms.outdated" } });
    expect(identity.devices.all()).toHaveLength(0);
  });
});

describe("registration and email verification", () => {
  let identity: TestIdentity;
  beforeEach(() => {
    identity = createTestIdentity();
  });

  it("creates an unverified account and emails a verification link", async () => {
    const result = await new RegisterUser(identity).execute({
      email: " Ada@Example.com ",
      password: PASSWORD,
      ...gate,
    });

    expect(result.ok).toBe(true);
    const user = await identity.users.findByEmail(EMAIL);
    expect(user?.isEmailVerified).toBe(false);
    expect(user?.passwordHash).toBe(`hashed:${PASSWORD}`);
    expect(identity.events.published.at(-1)).toMatchObject({
      routingKey: "notifications.email-requested.v1",
      payload: { to: EMAIL, template: "verify-email" },
    });
  });

  it("does not reveal that an email is taken", async () => {
    await registerVerified(identity);

    const result = await new RegisterUser(identity).execute({
      email: EMAIL,
      password: "another password!",
      ...gate,
    });

    expect(result.ok).toBe(true);
    expect(identity.users.all()).toHaveLength(1);
    expect(identity.events.published.at(-1)?.payload).toMatchObject({
      to: EMAIL,
      template: "account-exists",
    });
  });

  it("verifies the email once per token", async () => {
    await new RegisterUser(identity).execute({ email: EMAIL, password: PASSWORD, ...gate });
    const token = lastEmailToken(identity, EMAIL);

    expect((await new VerifyEmail(identity).execute(token)).ok).toBe(true);
    expect((await identity.users.findByEmail(EMAIL))?.isEmailVerified).toBe(true);
    expect(await new VerifyEmail(identity).execute(token)).toMatchObject({
      error: { code: "auth.invalid_token" },
    });
  });

  it("resends verification only for unverified accounts", async () => {
    await new RegisterUser(identity).execute({ email: EMAIL, password: PASSWORD, ...gate });
    const user = (await identity.users.findByEmail(EMAIL))!;
    const principal: Principal = {
      kind: "user",
      subjectId: user.id,
      deviceId: "d",
      roles: [],
      emailVerified: false,
      mfa: false,
      termsVersion: TEST_TERMS_VERSION,
    };
    const before = identity.events.published.length;

    await new ResendVerification(identity).execute(principal);
    expect(identity.events.published.length).toBe(before + 1);

    await new VerifyEmail(identity).execute(lastEmailToken(identity, EMAIL));
    await new ResendVerification(identity).execute(principal);
    expect(identity.events.published.length).toBe(before + 1);
  });
});

describe("login", () => {
  let identity: TestIdentity;
  beforeEach(() => {
    identity = createTestIdentity();
  });

  it("signs in a verified account", async () => {
    const user = await registerVerified(identity);

    const session = await loginOk(identity);

    expect(session.principal).toMatchObject({
      kind: "user",
      subjectId: user.id,
      emailVerified: true,
      mfa: false,
    });
    expect(await identity.accessTokens.verify(session.accessToken.token)).toMatchObject({
      subjectId: user.id,
    });
  });

  it("rejects unknown emails and wrong passwords with the same error", async () => {
    await registerVerified(identity);
    const login = new Login(identity);

    const unknown = await login.execute({
      email: "nobody@example.com",
      password: PASSWORD,
      deviceFingerprint: FINGERPRINT,
    });
    const wrong = await login.execute({
      email: EMAIL,
      password: "wrong password",
      deviceFingerprint: FINGERPRINT,
    });

    expect(unknown).toMatchObject({ ok: false, error: { code: "auth.invalid_credentials" } });
    expect(wrong).toMatchObject({ ok: false, error: { code: "auth.invalid_credentials" } });
  });

  it("locks the account after repeated failures, then unlocks after the lockout", async () => {
    await registerVerified(identity);
    const login = new Login(identity);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await login.execute({ email: EMAIL, password: "wrong password", deviceFingerprint: FINGERPRINT });
    }

    const locked = await login.execute({ email: EMAIL, password: PASSWORD, deviceFingerprint: FINGERPRINT });
    expect(locked).toMatchObject({ ok: false, error: { code: "auth.locked", type: "rate_limited" } });

    identity.now = new Date(identity.now.getTime() + 61_000);
    expect(
      (await login.execute({ email: EMAIL, password: PASSWORD, deviceFingerprint: FINGERPRINT })).ok,
    ).toBe(true);
  });

  it("requires email verification", async () => {
    await new RegisterUser(identity).execute({ email: EMAIL, password: PASSWORD, ...gate });

    const result = await new Login(identity).execute({
      email: EMAIL,
      password: PASSWORD,
      deviceFingerprint: FINGERPRINT,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "auth.email_not_verified" } });
  });
});

describe("two-factor authentication", () => {
  let identity: TestIdentity;
  let principal: Principal;

  beforeEach(async () => {
    identity = createTestIdentity();
    await registerVerified(identity);
    principal = (await loginOk(identity)).principal;
  });

  async function enable() {
    const setup = await new StartTwoFactorSetup(identity).execute(principal);
    expect(setup).toMatchObject({ ok: true, value: { secret: "SECRET" } });
    const confirmed = await new ConfirmTwoFactorSetup(identity).execute(principal, VALID_TOTP);
    if (!confirmed.ok) throw new Error(confirmed.error.code);
    return confirmed.value;
  }

  it("enables 2FA, returns recovery codes and a multi-factor session", async () => {
    const enabled = await enable();

    expect(enabled.recoveryCodes).toEqual(["aaaaa-11111", "bbbbb-22222"]);
    expect(enabled.session.principal.mfa).toBe(true);
    expect((await identity.users.findByEmail(EMAIL))?.isTwoFactorEnabled).toBe(true);
  });

  it("rejects a wrong confirmation code", async () => {
    await new StartTwoFactorSetup(identity).execute(principal);

    const result = await new ConfirmTwoFactorSetup(identity).execute(principal, "000000");

    expect(result).toMatchObject({ ok: false, error: { code: "auth.invalid_two_factor" } });
  });

  it("signs out other sessions when 2FA is enabled", async () => {
    const other = await loginOk(identity);
    await enable();

    const refreshed = await new RefreshAuthSession(identity).execute(other.refreshToken.token);

    expect(refreshed).toMatchObject({ ok: false, error: { code: "auth.session_expired" } });
  });

  it("then requires a second factor at sign-in", async () => {
    await enable();
    const login = new Login(identity);

    const missing = await login.execute({ email: EMAIL, password: PASSWORD, deviceFingerprint: FINGERPRINT });
    const wrong = await login.execute({
      email: EMAIL,
      password: PASSWORD,
      deviceFingerprint: FINGERPRINT,
      totpCode: "000000",
    });

    expect(missing).toMatchObject({ ok: false, error: { code: "auth.two_factor_required" } });
    expect(wrong).toMatchObject({ ok: false, error: { code: "auth.invalid_two_factor" } });
    expect((await loginOk(identity, { totpCode: VALID_TOTP })).principal.mfa).toBe(true);
  });

  it("accepts each recovery code exactly once", async () => {
    await enable();

    expect((await loginOk(identity, { recoveryCode: "aaaaa-11111" })).principal.mfa).toBe(true);
    const reused = await new Login(identity).execute({
      email: EMAIL,
      password: PASSWORD,
      deviceFingerprint: FINGERPRINT,
      recoveryCode: "aaaaa-11111",
    });
    expect(reused).toMatchObject({ ok: false, error: { code: "auth.invalid_two_factor" } });
  });

  it("cannot be enabled twice", async () => {
    await enable();
    expect(await new StartTwoFactorSetup(identity).execute(principal)).toMatchObject({
      ok: false,
      error: { code: "two_factor.already_enabled" },
    });
  });
});

describe("session refresh and logout", () => {
  let identity: TestIdentity;
  beforeEach(() => {
    identity = createTestIdentity();
  });

  it("rotates refresh tokens and detects reuse", async () => {
    await registerVerified(identity);
    const session = await loginOk(identity);
    const refresh = new RefreshAuthSession(identity);

    const rotated = await refresh.execute(session.refreshToken.token);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    const reused = await refresh.execute(session.refreshToken.token);
    expect(reused).toMatchObject({ ok: false, error: { code: "auth.session_expired" } });
    expect(await refresh.execute(rotated.value.refreshToken.token)).toMatchObject({ ok: false });
  });

  it("refreshes anonymous sessions", async () => {
    const created = await new CreateAnonymousSession(identity).execute({
      deviceFingerprint: FINGERPRINT,
      ...gate,
    });
    if (!created.ok) throw new Error("setup");

    const refreshed = await new RefreshAuthSession(identity).execute(created.value.refreshToken.token);

    expect(refreshed).toMatchObject({ ok: true, value: { principal: { kind: "anonymous" } } });
  });

  it("refuses to refresh a locked account", async () => {
    const user = await registerVerified(identity);
    const session = await loginOk(identity);
    user.recordFailedLogin(identity.now, { maxFailedAttempts: 1, lockoutMs: 60_000 });

    expect(await new RefreshAuthSession(identity).execute(session.refreshToken.token)).toMatchObject({
      ok: false,
    });
  });

  it("logout revokes the session family", async () => {
    await registerVerified(identity);
    const session = await loginOk(identity);

    await new Logout(identity).execute(session.refreshToken.token);

    expect(await new RefreshAuthSession(identity).execute(session.refreshToken.token)).toMatchObject({
      ok: false,
    });
  });
});

describe("password reset", () => {
  let identity: TestIdentity;
  beforeEach(() => {
    identity = createTestIdentity();
  });

  it("emails a reset link only for existing verified accounts", async () => {
    await new RequestPasswordReset(identity).execute("nobody@example.com");
    expect(identity.events.published).toHaveLength(0);

    await registerVerified(identity);
    await new RequestPasswordReset(identity).execute(EMAIL);
    expect(identity.events.published.at(-1)?.payload).toMatchObject({ template: "password-reset" });
  });

  it("changes the password and signs out every session", async () => {
    await registerVerified(identity);
    const session = await loginOk(identity);
    await new RequestPasswordReset(identity).execute(EMAIL);

    const result = await new ResetPassword(identity).execute({
      token: lastEmailToken(identity, EMAIL),
      password: "a brand new password",
    });

    expect(result.ok).toBe(true);
    expect(await new RefreshAuthSession(identity).execute(session.refreshToken.token)).toMatchObject({
      ok: false,
    });
    const login = await new Login(identity).execute({
      email: EMAIL,
      password: "a brand new password",
      deviceFingerprint: FINGERPRINT,
    });
    expect(login.ok).toBe(true);
  });

  it("rejects unknown reset tokens", async () => {
    expect(
      await new ResetPassword(identity).execute({ token: "x".repeat(32), password: "a brand new password" }),
    ).toMatchObject({ ok: false, error: { code: "auth.invalid_token" } });
  });
});

describe("account and terms", () => {
  it("describes the current account with permissions", async () => {
    const identity = createTestIdentity();
    const staff = User.createStaff("mod@example.com", "hashed:x", ["Moderator"], identity.now);
    await identity.users.add(staff);

    const account = await new GetCurrentAccount(identity).execute({
      kind: "user",
      subjectId: staff.id,
      deviceId: "d",
      roles: ["Moderator"],
      emailVerified: true,
      mfa: true,
      termsVersion: null,
    });

    expect(account).toMatchObject({
      ok: true,
      value: { email: "mod@example.com", roles: ["Moderator"], termsCurrent: false, mfa: true },
    });
    if (account.ok) expect(account.value.permissions).toContain("reports.review");
  });

  it("accepting the current terms returns a token carrying the new version", async () => {
    const identity = createTestIdentity();
    const created = await new CreateAnonymousSession(identity).execute({
      deviceFingerprint: FINGERPRINT,
      ...gate,
    });
    if (!created.ok) throw new Error("setup");
    const outdated = { ...created.value.principal, termsVersion: "old" };

    const result = await new AcceptCurrentTerms(identity).execute(outdated, gate);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((await identity.accessTokens.verify(result.value.token))?.termsVersion).toBe(TEST_TERMS_VERSION);
    }
  });
});
