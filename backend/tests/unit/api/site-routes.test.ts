import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../src/api/app.js";
import { authenticate } from "../../../src/api/auth/authentication.js";
import { registerIdentityOpenApi } from "../../../src/api/features/identity/identity-openapi.js";
import { createIdentityRouter } from "../../../src/api/features/identity/identity-router.js";
import { createSiteRouter, registerSiteOpenApi } from "../../../src/api/features/site/site-router.js";
import type { SiteConfigRepository } from "../../../src/application/features/site/site-config.js";
import { DEFAULT_SITE_CONFIG, type SiteConfig } from "../../../src/domain/site/site-config.js";
import { createLogger } from "../../../src/infrastructure/observability/logger.js";
import { staffPrincipal } from "../../support/admin-fakes.js";
import { createTestIdentity, TEST_TERMS_VERSION } from "../../support/identity-fakes.js";
import { RecordingAudit } from "../../support/moderation-fakes.js";

const logger = createLogger({ service: "test", level: "silent", pretty: false });

class InMemorySiteConfig implements SiteConfigRepository {
  config: SiteConfig = DEFAULT_SITE_CONFIG;

  current(): Promise<SiteConfig> {
    return Promise.resolve(this.config);
  }

  save(config: SiteConfig): Promise<void> {
    this.config = config;
    return Promise.resolve();
  }
}

function setup() {
  const identity = createTestIdentity();
  const siteConfig = new InMemorySiteConfig();
  const audit = new RecordingAudit();
  const app = createApp({
    logger,
    corsAllowedOrigins: ["http://localhost:3000"],
    healthChecks: [],
    enableApiReference: true,
    trustProxy: "loopback",
    authenticate: authenticate(identity.accessTokens),
    features: [
      { router: createSiteRouter({ siteConfig, audit }), openApi: registerSiteOpenApi },
      {
        router: createIdentityRouter({
          context: identity,
          rateLimiter: { consume: () => Promise.resolve({ allowed: true, remaining: 9, retryAfterMs: 0 }) },
          cookieSecure: true,
          rateLimitMultiplier: 1,
          siteConfig,
        }),
        openApi: registerIdentityOpenApi,
      },
    ],
  });
  const token = async (roles: Parameters<typeof staffPrincipal>[0]) =>
    `Bearer ${(await identity.accessTokens.issue(staffPrincipal(roles))).token}`;
  return { app, siteConfig, audit, token };
}

const update = {
  maintenance: { enabled: true, message: "Back at noon." },
  announcement: { message: "New: video chat is here.", tone: "info" },
  features: { textChat: true, videoChat: true, registration: false },
};

describe("site routes", () => {
  it("serve the public configuration without editor details", async () => {
    const { app, siteConfig } = setup();
    siteConfig.config = { ...DEFAULT_SITE_CONFIG, updatedBy: "staff-1", updatedAt: new Date() };

    const response = await request(app).get("/api/v1/site").expect(200);
    expect(response.body).toEqual({
      maintenance: { enabled: false, message: null },
      announcement: null,
      features: { textChat: true, videoChat: true, registration: true },
    });
    expect(response.headers["cache-control"]).toBe("public, max-age=15");
  });

  it("let flag managers update the configuration, audited", async () => {
    const { app, siteConfig, audit, token } = setup();

    await request(app)
      .put("/api/v1/admin/site")
      .set("Authorization", await token(["Moderator"]))
      .send(update)
      .expect(403);
    const saved = await request(app)
      .put("/api/v1/admin/site")
      .set("Authorization", await token(["Admin"]))
      .send(update);

    expect(saved.status).toBe(200);
    expect(siteConfig.config).toMatchObject({ ...update, updatedBy: "staff-Admin" });
    expect(audit.entries[0]).toMatchObject({
      action: "site.updated",
      metadata: {
        maintenance: "false -> true",
        announcement: "none -> New: video chat is here.",
        changedFlags: "registration",
      },
    });
    await request(app)
      .put("/api/v1/admin/site")
      .set("Authorization", await token(["Admin"]))
      .send({ ...update, announcement: { message: "", tone: "info" } })
      .expect(400);
  });

  it("close registration when the flag is off", async () => {
    const { app, siteConfig } = setup();
    siteConfig.config = {
      ...DEFAULT_SITE_CONFIG,
      features: { ...DEFAULT_SITE_CONFIG.features, registration: false },
    };

    const response = await request(app).post("/api/v1/auth/register").send({
      email: "new@example.com",
      password: "correct horse battery staple",
      ageConfirmed: true,
      termsVersion: TEST_TERMS_VERSION,
      deviceFingerprint: "device-fingerprint-0001",
    });
    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe("auth.registration_closed");
  });
});
