import { describe, expect, it } from "vitest";
import {
  isStaff,
  PERMISSIONS,
  permissionsFor,
  ROLE_PERMISSIONS,
} from "../../../src/domain/identity/roles.js";
import { acceptTerms, isCurrentAcceptance } from "../../../src/domain/identity/terms-acceptance.js";
import { normalizeEmail, User } from "../../../src/domain/identity/user.js";

const NOW = new Date("2026-10-25T12:00:00Z");
const policy = { maxFailedAttempts: 3, lockoutMs: 60_000 };

const newUser = () => User.register("Ada@Example.com", "hash", acceptTerms("v1", NOW), NOW);

describe("roles and permissions", () => {
  it("gives SuperAdmin every permission and only SuperAdmin staff management", () => {
    expect([...permissionsFor(["SuperAdmin"])]).toEqual([...PERMISSIONS]);
    expect(permissionsFor(["Admin"]).has("staff.manage")).toBe(false);
  });

  it("keeps Support read-mostly", () => {
    expect(ROLE_PERMISSIONS.Support).not.toContain("moderation.act");
    expect(ROLE_PERMISSIONS.Support).not.toContain("bans.manage");
  });

  it("merges permissions across roles", () => {
    const merged = permissionsFor(["Support", "Moderator"]);
    expect(merged.has("moderation.act")).toBe(true);
    expect(merged.has("appeals.review")).toBe(true);
  });

  it("treats any role as staff", () => {
    expect(isStaff([])).toBe(false);
    expect(isStaff(["Support"])).toBe(true);
  });
});

describe("terms acceptance", () => {
  it("is current only for the same version", () => {
    const acceptance = acceptTerms("v2", NOW);
    expect(acceptance.ageConfirmed).toBe(true);
    expect(isCurrentAcceptance(acceptance, "v2")).toBe(true);
    expect(isCurrentAcceptance(acceptance, "v3")).toBe(false);
    expect(isCurrentAcceptance(null, "v2")).toBe(false);
  });
});

describe("User", () => {
  it("normalises the email and starts unverified with no roles", () => {
    const user = newUser();
    expect(user.email).toBe("ada@example.com");
    expect(normalizeEmail("  MIXED@Case.org ")).toBe("mixed@case.org");
    expect(user.isEmailVerified).toBe(false);
    expect(user.isStaff).toBe(false);
  });

  it("creates staff verified but without 2FA", () => {
    const staff = User.createStaff("admin@example.com", "hash", ["SuperAdmin"], NOW);
    expect(staff.isEmailVerified).toBe(true);
    expect(staff.isStaff).toBe(true);
    expect(staff.isTwoFactorEnabled).toBe(false);
  });

  it("locks after the configured number of failures and resets on success", () => {
    const user = newUser();
    user.recordFailedLogin(NOW, policy);
    user.recordFailedLogin(NOW, policy);
    expect(user.isLocked(NOW)).toBe(false);

    user.recordFailedLogin(NOW, policy);
    expect(user.isLocked(NOW)).toBe(true);
    expect(user.isLocked(new Date(NOW.getTime() + 60_001))).toBe(false);

    user.recordSuccessfulLogin();
    expect(user.isLocked(NOW)).toBe(false);
    expect(user.failedLoginCount).toBe(0);
  });

  it("keeps the first verification time", () => {
    const user = newUser();
    user.verifyEmail(NOW);
    user.verifyEmail(new Date(NOW.getTime() + 1000));
    expect(user.emailVerifiedAt).toEqual(NOW);
  });

  it("enables 2FA only after enrolment and consumes recovery codes once", () => {
    const user = newUser();
    expect(user.enableTwoFactor([], NOW)).toMatchObject({
      ok: false,
      error: { code: "two_factor.not_started" },
    });

    expect(user.startTwoFactorEnrollment("encrypted").ok).toBe(true);
    expect(user.isTwoFactorEnabled).toBe(false);
    expect(user.enableTwoFactor(["h1", "h2"], NOW).ok).toBe(true);
    expect(user.isTwoFactorEnabled).toBe(true);

    expect(user.useRecoveryCode("h1")).toBe(true);
    expect(user.useRecoveryCode("h1")).toBe(false);
    expect(user.twoFactor?.recoveryCodeHashes).toEqual(["h2"]);
  });

  it("clears a lockout when the password changes", () => {
    const user = newUser();
    for (let attempt = 0; attempt < 3; attempt += 1) user.recordFailedLogin(NOW, policy);

    user.changePassword("new-hash");

    expect(user.isLocked(NOW)).toBe(false);
    expect(user.passwordHash).toBe("new-hash");
  });
});
