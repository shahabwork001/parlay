import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../src/api/app.js";
import type { HealthCheck, HealthStatus } from "../../../src/infrastructure/health/health-check.js";
import { createLogger } from "../../../src/infrastructure/observability/logger.js";

const FRONTEND = "http://localhost:3000";
const logger = createLogger({ service: "test", level: "silent", pretty: false });

const check = (name: string, status: HealthStatus): HealthCheck => ({
  name,
  check: () => Promise.resolve({ status, description: "internal detail" }),
});

const buildApp = (checks: HealthCheck[] = [check("mongodb", "Healthy")], enableApiReference = false) =>
  createApp({ logger, corsAllowedOrigins: [FRONTEND], healthChecks: checks, enableApiReference });

describe("health endpoints", () => {
  it("liveness reports healthy without dependency checks", async () => {
    const response = await request(buildApp([check("mongodb", "Unhealthy")])).get("/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "Healthy", checks: [] });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("readiness lists every component and returns 200 when healthy", async () => {
    const response = await request(buildApp([check("mongodb", "Healthy"), check("redis", "Healthy")])).get(
      "/health/ready",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "Healthy",
      checks: [
        { name: "mongodb", status: "Healthy" },
        { name: "redis", status: "Healthy" },
      ],
    });
  });

  it("readiness returns 503 when a dependency is unhealthy and hides details", async () => {
    const response = await request(
      buildApp([check("mongodb", "Healthy"), check("rabbitmq", "Unhealthy")]),
    ).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("Unhealthy");
    expect(JSON.stringify(response.body)).not.toContain("internal detail");
  });

  it("readiness stays 200 when only degraded", async () => {
    const response = await request(buildApp([check("redis", "Degraded")])).get("/health/ready");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("Degraded");
  });
});

describe("cross-cutting behaviour", () => {
  it("sets security headers and hides the framework", async () => {
    const response = await request(buildApp()).get("/health/live");

    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns RFC 7807 problem details for unknown routes", async () => {
    const response = await request(buildApp()).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({ status: 404, title: "Not found", instance: "/does-not-exist" });
    expect(response.body.traceId).toBe(response.headers["x-request-id"]);
  });

  it("returns 400 problem details for malformed JSON bodies", async () => {
    const response = await request(buildApp())
      .post("/anything")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("logs requests without IP addresses or headers", async () => {
    const lines: string[] = [];
    const capturingLogger = pino({ level: "info" }, { write: (line: string) => lines.push(line) });
    const app = createApp({
      logger: capturingLogger,
      corsAllowedOrigins: [FRONTEND],
      healthChecks: [],
      enableApiReference: false,
    });

    await request(app).get("/nope").set("Authorization", "Bearer secret");

    const entry = JSON.parse(lines.find((line) => line.includes("request completed"))!);
    expect(entry.req).toEqual({ id: expect.any(String), method: "GET", url: "/nope" });
    expect(entry.res).toEqual({ statusCode: 404 });
    expect(lines.join("")).not.toMatch(/remoteAddress|secret/);
  });

  it("propagates a well-formed incoming request id", async () => {
    const response = await request(buildApp()).get("/health/live").set("X-Request-Id", "abcdef12-3456");
    expect(response.headers["x-request-id"]).toBe("abcdef12-3456");
  });

  it("replaces a malformed incoming request id", async () => {
    const response = await request(buildApp()).get("/health/live").set("X-Request-Id", "<script>");
    expect(response.headers["x-request-id"]).not.toBe("<script>");
  });

  it("allows CORS only for the configured frontend origin", async () => {
    const app = buildApp();
    const allowed = await request(app)
      .options("/health/live")
      .set("Origin", FRONTEND)
      .set("Access-Control-Request-Method", "GET");
    const denied = await request(app)
      .options("/health/live")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "GET");

    expect(allowed.headers["access-control-allow-origin"]).toBe(FRONTEND);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("API reference", () => {
  it("is not exposed unless enabled", async () => {
    expect((await request(buildApp()).get("/openapi.json")).status).toBe(404);
  });

  it("serves the OpenAPI document and Scalar when enabled", async () => {
    const app = buildApp(undefined, true);

    const document = await request(app).get("/openapi.json");
    const scalar = await request(app).get("/scalar");

    expect(document.status).toBe(200);
    expect(document.body.openapi).toBe("3.1.0");
    expect(Object.keys(document.body.paths)).toEqual(["/health/live", "/health/ready"]);
    expect(scalar.status).toBe(200);
    expect(scalar.headers["content-security-policy"]).toContain("cdn.jsdelivr.net");
  });
});
