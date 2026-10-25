import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/api/app.js";
import { testAppDefaults } from "../support/app-defaults.js";
import { createInfrastructure, type Infrastructure } from "../../src/infrastructure/infrastructure.js";
import { silentLogger, testInfrastructureConfig, waitFor } from "./support.js";

describe("API readiness against real dependencies", () => {
  let infrastructure: Infrastructure;

  beforeAll(async () => {
    infrastructure = await createInfrastructure(testInfrastructureConfig(), silentLogger, "readiness-tests");
    await waitFor(() => infrastructure.rabbitMq.isConnected);
  });

  afterAll(async () => {
    await infrastructure.close();
  });

  it("reports MongoDB, Redis and RabbitMQ as healthy", async () => {
    const app = createApp({
      ...testAppDefaults,
      logger: silentLogger,
      corsAllowedOrigins: ["http://localhost:3000"],
      healthChecks: infrastructure.healthChecks,
      enableApiReference: false,
    });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "Healthy",
      checks: [
        { name: "mongodb", status: "Healthy" },
        { name: "redis", status: "Healthy" },
        { name: "rabbitmq", status: "Healthy" },
      ],
    });
  });
});
