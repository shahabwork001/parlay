import { Secret, TOTP } from "otpauth";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import type { Principal } from "../../../src/application/features/identity/ports.js";
import { renderEmail } from "../../../src/application/features/notifications/email-templates.js";
import {
  AesGcmSecretCipher,
  Argon2PasswordHasher,
  HmacKeyedHasher,
} from "../../../src/infrastructure/identity/crypto.js";
import { JwtAccessTokenService } from "../../../src/infrastructure/identity/jwt-access-tokens.js";
import { OtpTotpService } from "../../../src/infrastructure/identity/otp-totp-service.js";

const SECRET = "a-test-signing-secret-of-32-chars!!";
const settings = { secret: SECRET, issuer: "parley", audience: "parley-clients", ttlSeconds: 900 };

const principal: Principal = {
  kind: "user",
  subjectId: "user-1",
  deviceId: "device-1",
  roles: ["Moderator"],
  emailVerified: true,
  mfa: true,
  termsVersion: "2026-10-25",
};

describe("Argon2PasswordHasher", () => {
  it("hashes with argon2id and verifies", async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash("correct horse battery");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await hasher.verify(hash, "correct horse battery")).toBe(true);
    expect(await hasher.verify(hash, "wrong")).toBe(false);
    expect(await hasher.verify("not-a-hash", "anything")).toBe(false);
  });
});

describe("HmacKeyedHasher", () => {
  it("is deterministic per purpose and key", () => {
    const hasher = new HmacKeyedHasher("pepper-1");

    expect(hasher.hash("device", "abc")).toBe(hasher.hash("device", "abc"));
    expect(hasher.hash("device", "abc")).not.toBe(hasher.hash("ip", "abc"));
    expect(new HmacKeyedHasher("pepper-2").hash("device", "abc")).not.toBe(hasher.hash("device", "abc"));
  });
});

describe("AesGcmSecretCipher", () => {
  const cipher = new AesGcmSecretCipher(Buffer.alloc(32, 9).toString("base64"));

  it("round-trips and uses a fresh IV each time", () => {
    const first = cipher.encrypt("JBSWY3DPEHPK3PXP");
    expect(cipher.decrypt(first)).toBe("JBSWY3DPEHPK3PXP");
    expect(cipher.encrypt("JBSWY3DPEHPK3PXP")).not.toBe(first);
  });

  it("detects tampering", () => {
    const encrypted = Buffer.from(cipher.encrypt("secret"), "base64url");
    encrypted[encrypted.length - 1] = (encrypted.at(-1) ?? 0) ^ 1;
    expect(() => cipher.decrypt(encrypted.toString("base64url"))).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => new AesGcmSecretCipher(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("JwtAccessTokenService", () => {
  const service = new JwtAccessTokenService(settings);

  it("round-trips the principal", async () => {
    const issued = await service.issue(principal);

    expect(await service.verify(issued.token)).toEqual(principal);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now() + 890_000);
  });

  it("rejects tokens signed with another key, for another audience, or expired", async () => {
    const issued = await new JwtAccessTokenService({ ...settings, secret: "x".repeat(40) }).issue(principal);
    const otherAudience = await new JwtAccessTokenService({ ...settings, audience: "other" }).issue(
      principal,
    );
    const expired = await new SignJWT({ knd: "user", dev: "d", rol: [], ev: true, mfa: false, tv: null })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u")
      .setIssuer("parley")
      .setAudience("parley-clients")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));

    expect(await service.verify(issued.token)).toBeNull();
    expect(await service.verify(otherAudience.token)).toBeNull();
    expect(await service.verify(expired)).toBeNull();
    expect(await service.verify("garbage")).toBeNull();
  });

  it("rejects tokens with unknown roles", async () => {
    const forged = await new SignJWT({ knd: "user", dev: "d", rol: ["God"], ev: true, mfa: true, tv: null })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u")
      .setIssuer("parley")
      .setAudience("parley-clients")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(SECRET));

    expect(await service.verify(forged)).toBeNull();
  });
});

describe("OtpTotpService", () => {
  const service = new OtpTotpService("Parley");

  it("verifies codes from a standard authenticator", () => {
    const secret = service.generateSecret();
    const code = new TOTP({ secret: Secret.fromBase32(secret) }).generate();

    expect(service.verify(secret, code)).toBe(true);
    expect(service.verify(secret, code === "000000" ? "111111" : "000000")).toBe(false);
    expect(service.buildUri(secret, "ada@example.com")).toMatch(
      /^otpauth:\/\/totp\/Parley:ada%40example\.com\?/,
    );
  });

  it("generates ten unique recovery codes in the expected format", () => {
    const codes = service.generateRecoveryCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
  });
});

describe("renderEmail", () => {
  it("renders text and escaped HTML with the action link", () => {
    const message = renderEmail({
      to: "ada@example.com",
      template: "verify-email",
      link: "https://parley.example/verify-email?token=a&b=<x>",
    });

    expect(message.subject).toBe("Confirm your email for Parley");
    expect(message.text).toContain("Confirm email: https://parley.example/verify-email?token=a&b=<x>");
    expect(message.html).toContain("token=a&amp;b=&lt;x&gt;");
    expect(message.html).not.toContain("<x>");
  });
});
