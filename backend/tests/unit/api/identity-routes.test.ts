import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RateLimiter } from "../../../src/application/abstractions/rate-limiter.js";
import { createApp } from "../../../src/api/app.js";
import { authenticate, requirePermission } from "../../../src/api/auth/authentication.js";
import { registerIdentityOpenApi } from "../../../src/api/features/identity/identity-openapi.js";
import { createIdentityRouter } from "../../../src/api/features/identity/identity-router.js";
import { rateLimit } from "../../../src/api/middleware/rate-limit.js";
import { type User } from "../../../src/domain/identity/user.js";
import { createLogger } from "../../../src/infrastructure/observability/logger.js";
import {
  createTestIdentity,
  fakeHasher,
  lastEmailToken,
  MutableSiteConfig,
  TEST_TERMS_VERSION,
  type TestIdentity,
} from "../../support/identity-fakes.js";

const logger = createLogger({ service: "test", level: "silent", pretty: false });
const allowAll: RateLimiter = {
  consume: () => Promise.resolve({ allowed: true, remaining: 99, retryAfterMs: 0 }),
};
const FINGERPRINT = "device-fingerprint-0001";
const gate = { ageConfirmed: true, termsVersion: TEST_TERMS_VERSION };

function buildApp(
  identity: TestIdentity,
  rateLimiter: RateLimiter = allowAll,
  siteConfig: MutableSiteConfig = new MutableSiteConfig(),
) {
  return createApp({
    logger,
    corsAllowedOrigins: ["http://localhost:3000"],
    healthChecks: [],
    enableApiReference: true,
    trustProxy: "loopback",
    authenticate: authenticate(identity.accessTokens),
    features: [
      {
        router: createIdentityRouter({
          context: identity,
          rateLimiter,
          cookieSecure: true,
          rateLimitMultiplier: 1,
          siteConfig,
        }),
        openApi: registerIdentityOpenApi,
      },
    ],
  });
}

const refreshCookie = (response: request.Response): string => {
  const cookies = response.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith("parley_refresh="));
  if (!cookie) throw new Error("No refresh cookie");
  return cookie;
};

describe("identity routes", () => {
  let identity: TestIdentity;
  let app: express.Express;

  beforeEach(() => {
    identity = createTestIdentity();
    app = buildApp(identity);
  });

  it("exposes the current terms version", async () => {
    const response = await request(app).get("/api/v1/legal/terms");
    expect(response.body).toEqual({ version: TEST_TERMS_VERSION });
  });

  it("starts an anonymous session with an httpOnly, strict, path-scoped refresh cookie", async () => {
    const response = await request(app)
      .post("/api/v1/auth/anonymous")
      .send({ deviceFingerprint: FINGERPRINT, ...gate });

    expect(response.status).toBe(200);
    expect(response.body.principal).toEqual({
      kind: "anonymous",
      roles: [],
      emailVerified: false,
      mfa: false,
      termsVersion: TEST_TERMS_VERSION,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    const cookie = refreshCookie(response);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it("requires the 18+ confirmation", async () => {
    const response = await request(app)
      .post("/api/v1/auth/anonymous")
      .send({ deviceFingerprint: FINGERPRINT, ageConfirmed: false, termsVersion: TEST_TERMS_VERSION });

    expect(response.status).toBe(400);
    expect(response.body.errors["body.ageConfirmed"]).toEqual(["You must confirm you are 18 or older."]);
  });

  it("returns 400 terms.outdated for an old terms version", async () => {
    const response = await request(app)
      .post("/api/v1/auth/anonymous")
      .send({ deviceFingerprint: FINGERPRINT, ageConfirmed: true, termsVersion: "2001-01-01" });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe("terms.outdated");
  });

  it("runs the full account flow: register, verify, login, me, refresh, logout", async () => {
    const register = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "ada@example.com", password: "correct horse battery", ...gate });
    expect(register.status).toBe(202);

    const verify = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: lastEmailToken(identity, "ada@example.com") });
    expect(verify.status).toBe(204);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ada@example.com", password: "correct horse battery", deviceFingerprint: FINGERPRINT });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${login.body.accessToken as string}`);
    expect(me.body).toMatchObject({
      kind: "user",
      email: "ada@example.com",
      emailVerified: true,
      termsCurrent: true,
    });

    const refreshed = await request(app).post("/api/v1/auth/refresh").set("Cookie", refreshCookie(login));
    expect(refreshed.status).toBe(200);
    expect(refreshCookie(refreshed)).not.toBe(refreshCookie(login));

    const logout = await request(app).post("/api/v1/auth/logout").set("Cookie", refreshCookie(refreshed));
    expect(logout.status).toBe(204);
    expect(refreshCookie(logout)).toMatch(/parley_refresh=;/);

    const afterLogout = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie(refreshed));
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.errorCode).toBe("auth.session_expired");
  });

  it("returns 401 for refresh without a cookie", async () => {
    const response = await request(app).post("/api/v1/auth/refresh");
    expect(response.status).toBe(401);
  });

  it("protects /me", async () => {
    const anonymous = await request(app).get("/api/v1/me");
    const forged = await request(app).get("/api/v1/me").set("Authorization", "Bearer not.a.token");

    expect(anonymous.status).toBe(401);
    expect(anonymous.headers["www-authenticate"]).toContain("Bearer");
    expect(forged.status).toBe(401);
  });

  it("always answers forgot-password with 202", async () => {
    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({ email: "nobody@example.com" });
    expect(response.status).toBe(202);
  });

  it("documents every identity route in OpenAPI", async () => {
    const document = await request(app).get("/openapi.json");
    const paths = Object.keys(document.body.paths as Record<string, unknown>);

    expect(paths).toEqual(
      expect.arrayContaining(["/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/me/two-factor/confirm"]),
    );
    expect(document.body.components.securitySchemes.bearerAuth).toMatchObject({ scheme: "bearer" });
  });
});

describe("requirePermission", () => {
  async function tokenFor(identity: TestIdentity, mfa: boolean, roles: User["roles"]) {
    return (
      await identity.accessTokens.issue({
        kind: "user",
        subjectId: "u1",
        deviceId: "d1",
        roles,
        emailVerified: true,
        mfa,
        termsVersion: null,
      })
    ).token;
  }

  function protectedApp(identity: TestIdentity) {
    const app = express();
    app.use(authenticate(identity.accessTokens));
    app.get("/admin", ...requirePermission("reports.review"), (_request, response) => {
      response.json({ ok: true });
    });
    return app;
  }

  it("allows staff with the permission and 2FA", async () => {
    const identity = createTestIdentity();
    const response = await request(protectedApp(identity))
      .get("/admin")
      .set("Authorization", `Bearer ${await tokenFor(identity, true, ["Moderator"])}`);
    expect(response.status).toBe(200);
  });

  it("requires 2FA for staff", async () => {
    const identity = createTestIdentity();
    const response = await request(protectedApp(identity))
      .get("/admin")
      .set("Authorization", `Bearer ${await tokenFor(identity, false, ["Moderator"])}`);
    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe("auth.mfa_required");
  });

  it("forbids roles without the permission", async () => {
    const identity = createTestIdentity();
    const response = await request(protectedApp(identity))
      .get("/admin")
      .set("Authorization", `Bearer ${await tokenFor(identity, true, [])}`);
    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe("auth.forbidden");
  });
});

describe("rateLimit middleware", () => {
  function limitedApp(limiter: RateLimiter) {
    const app = express();
    app.get(
      "/limited",
      rateLimit({ limiter, hasher: fakeHasher }, { name: "test", limit: 2, windowMs: 1000 }),
      (_q, s) => {
        s.json({ ok: true });
      },
    );
    return app;
  }

  it("returns 429 with Retry-After when the limit is exceeded", async () => {
    const limiter: RateLimiter = {
      consume: () => Promise.resolve({ allowed: false, remaining: 0, retryAfterMs: 1500 }),
    };
    const response = await request(limitedApp(limiter)).get("/limited");

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("2");
    expect(response.body.errorCode).toBe("rate_limited");
  });

  it("keys the bucket on the hashed client IP, never the raw address", async () => {
    const keys: string[] = [];
    const limiter: RateLimiter = {
      consume: (key) => {
        keys.push(key);
        return Promise.resolve({ allowed: true, remaining: 1, retryAfterMs: 0 });
      },
    };
    await request(limitedApp(limiter)).get("/limited");

    expect(keys[0]).toMatch(/^test:ip#/);
  });

  it("fails open when the limiter is unavailable", async () => {
    const limiter: RateLimiter = { consume: () => Promise.reject(new Error("redis down")) };
    const app = express();
    app.use((req, _res, next) => {
      req.log = logger;
      next();
    });
    app.use(limitedApp(limiter));

    expect((await request(app).get("/limited")).status).toBe(200);
  });
});
