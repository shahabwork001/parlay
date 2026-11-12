import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../src/api/app.js";
import { authenticate } from "../../../src/api/auth/authentication.js";
import { registerAdminOpenApi } from "../../../src/api/features/admin/admin-openapi.js";
import { createAdminRouter } from "../../../src/api/features/admin/admin-router.js";
import type { Principal } from "../../../src/application/features/identity/ports.js";
import type { Role } from "../../../src/domain/identity/roles.js";
import { createLogger } from "../../../src/infrastructure/observability/logger.js";
import { createAdminFakes, staffPrincipal } from "../../support/admin-fakes.js";

const logger = createLogger({ service: "test", level: "silent", pretty: false });

function setup() {
  const fakes = createAdminFakes();
  const app = createApp({
    logger,
    corsAllowedOrigins: ["http://localhost:3000"],
    healthChecks: [],
    enableApiReference: true,
    trustProxy: "loopback",
    authenticate: authenticate(fakes.identity.accessTokens),
    features: [
      {
        router: createAdminRouter({
          context: fakes.context,
          healthChecks: [{ name: "mongodb", check: () => Promise.resolve({ status: "Healthy" }) }],
        }),
        openApi: registerAdminOpenApi,
      },
    ],
  });
  const as = async (principal: Principal) =>
    `Bearer ${(await fakes.identity.accessTokens.issue(principal)).token}`;
  return { fakes, app, as };
}

const staff = (roles: Role[], mfa = true) => staffPrincipal(roles, { mfa });

describe("admin routes", () => {
  it("require a staff permission and a two-factor session", async () => {
    const { app, as } = setup();

    await request(app).get("/api/v1/admin/dashboard").expect(401);
    const visitor = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", await as(staff([])));
    expect(visitor.status).toBe(403);
    expect(visitor.body.errorCode).toBe("auth.forbidden");
    const noMfa = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", await as(staff(["Admin"], false)));
    expect(noMfa.body.errorCode).toBe("auth.mfa_required");

    const support = await as(staff(["Support"]));
    await request(app).get("/api/v1/admin/dashboard").set("Authorization", support).expect(200);
    await request(app).get("/api/v1/admin/reports").set("Authorization", support).expect(403);
    await request(app)
      .get("/api/v1/admin/staff")
      .set("Authorization", await as(staff(["Admin"])))
      .expect(403);
  });

  it("lets moderators decide reports and validates the decision", async () => {
    const { fakes, app, as } = setup();
    const report = await fakes.report("spam");
    const moderator = await as(staff(["Moderator"]));

    const invalid = await request(app)
      .post(`/api/v1/admin/reports/${report.id}/decision`)
      .set("Authorization", moderator)
      .send({ action: "ban", mode: "full" });
    expect(invalid.status).toBe(400);

    const decided = await request(app)
      .post(`/api/v1/admin/reports/${report.id}/decision`)
      .set("Authorization", moderator)
      .send({ action: "ban", mode: "shadow", durationHours: 24 });
    expect(decided.status).toBe(200);
    expect(decided.body).toMatchObject({ status: "actioned", resolution: { outcome: "banned" } });
    expect(decided.body.reported).toEqual({
      subjectId: "reported",
      deviceId: "device-of-reported",
      kind: "user",
    });
    expect(JSON.stringify(decided.body)).not.toContain("net-reported");

    const again = await request(app)
      .post(`/api/v1/admin/reports/${report.id}/decision`)
      .set("Authorization", moderator)
      .send({ action: "dismiss" });
    expect(again.status).toBe(409);
  });

  it("serves report detail, rules, system health and the API description", async () => {
    const { fakes, app, as } = setup();
    const report = await fakes.report();
    const admin = await as(staff(["Admin"]));

    const detail = await request(app).get(`/api/v1/admin/reports/${report.id}`).set("Authorization", admin);
    expect(detail.body).toMatchObject({ report: { id: report.id }, reportedTrust: 50 });
    await request(app).get("/api/v1/admin/reports/unknown").set("Authorization", admin).expect(404);

    const rules = await request(app).get("/api/v1/admin/rules/text").set("Authorization", admin);
    expect(rules.body.maxRepeats).toBe(3);
    const saved = await request(app)
      .put("/api/v1/admin/rules/text")
      .set("Authorization", admin)
      .send({ ...rules.body, maskedWords: ["Heck"] });
    expect(saved.body.maskedWords).toEqual(["heck"]);

    const system = await request(app).get("/api/v1/admin/system").set("Authorization", admin);
    expect(system.body.health.entries).toEqual([{ name: "mongodb", status: "Healthy" }]);

    const openApi = await request(app).get("/openapi.json");
    expect(Object.keys(openApi.body.paths)).toContain("/api/v1/admin/reports/{id}/decision");
  });
});
