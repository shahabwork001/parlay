import { describe, expect, it } from "vitest";
import { ConfigError, loadApiConfig, loadWorkersConfig } from "../../../src/infrastructure/config/config.js";

const baseEnvironment = {
  MONGO_URI: "mongodb://localhost:27017",
  REDIS_URL: "redis://localhost:6379",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://parley.example",
};

describe("loadApiConfig", () => {
  it("applies defaults and parses lists", () => {
    const config = loadApiConfig(baseEnvironment);

    expect(config.environment).toBe("development");
    expect(config.port).toBe(8080);
    expect(config.mongo.database).toBe("parley");
    expect(config.rabbitMq).toMatchObject({ prefetch: 16, deliveryLimit: 5, retryDelayMs: 1000 });
    expect(config.corsAllowedOrigins).toEqual(["http://localhost:3000", "https://parley.example"]);
  });

  it("coerces numeric settings", () => {
    const config = loadApiConfig({ ...baseEnvironment, PORT: "9000", RABBITMQ_DELIVERY_LIMIT: "3" });
    expect(config.port).toBe(9000);
    expect(config.rabbitMq.deliveryLimit).toBe(3);
  });

  it("lists every invalid setting at once", () => {
    const load = () => loadApiConfig({ CORS_ALLOWED_ORIGINS: "not-a-url" });

    expect(load).toThrow(ConfigError);
    expect(load).toThrow(/MONGO_URI/);
    expect(load).toThrow(/REDIS_URL/);
    expect(load).toThrow(/RABBITMQ_URL/);
    expect(load).toThrow(/CORS_ALLOWED_ORIGINS/);
  });
});

describe("loadWorkersConfig", () => {
  it("does not require CORS settings and defaults to port 8081", () => {
    const { CORS_ALLOWED_ORIGINS: _cors, ...workerEnvironment } = baseEnvironment;
    expect(loadWorkersConfig(workerEnvironment).port).toBe(8081);
  });
});
