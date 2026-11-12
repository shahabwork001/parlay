import { describe, expect, it } from "vitest";
import {
  ConfigError,
  loadApiConfig,
  loadSeedConfig,
  loadWorkersConfig,
} from "../../../src/infrastructure/config/config.js";

const infrastructure = {
  MONGO_URI: "mongodb://localhost:27017",
  REDIS_URL: "redis://localhost:6379",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
};

const api = {
  ...infrastructure,
  CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://parley.example",
  JWT_SECRET: "j".repeat(32),
  HASH_SECRET: "h".repeat(32),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  TURN_SECRET: "t".repeat(20),
  TURN_URLS: "turn:turn.example:3478?transport=udp, turns:turn.example:5349",
  STUN_URLS: "stun:turn.example:3478",
};

const workers = { ...infrastructure, SMTP_HOST: "mailpit" };

describe("loadApiConfig", () => {
  it("applies defaults and parses lists", () => {
    const config = loadApiConfig(api);

    expect(config.environment).toBe("development");
    expect(config.port).toBe(8080);
    expect(config.mongo.database).toBe("parley");
    expect(config.rabbitMq).toMatchObject({ prefetch: 16, deliveryLimit: 5, retryDelayMs: 1000 });
    expect(config.corsAllowedOrigins).toEqual(["http://localhost:3000", "https://parley.example"]);
    expect(config.frontendUrl).toBe("http://localhost:3000");
    expect(config.cookieSecure).toBe(true);
    expect(config.auth).toMatchObject({ accessTokenTtlSeconds: 900, refreshTokenTtlMs: 30 * 86_400_000 });
    expect(config.termsVersion).toBe("2026-10-28");
    expect(config.rateLimitMultiplier).toBe(1);
    expect(config.matchInterestFallbackMs).toBe(5000);
    expect(config.turn).toEqual({
      secret: "t".repeat(20),
      turnUrls: ["turn:turn.example:3478?transport=udp", "turns:turn.example:5349"],
      stunUrls: ["stun:turn.example:3478"],
      ttlSeconds: 3600,
    });
  });

  it("coerces numbers and booleans and trims the frontend URL", () => {
    const config = loadApiConfig({
      ...api,
      PORT: "9000",
      RABBITMQ_DELIVERY_LIMIT: "3",
      COOKIE_SECURE: "false",
      FRONTEND_URL: "https://parley.example/",
    });

    expect(config.port).toBe(9000);
    expect(config.rabbitMq.deliveryLimit).toBe(3);
    expect(config.cookieSecure).toBe(false);
    expect(config.frontendUrl).toBe("https://parley.example");
  });

  it("rejects weak secrets and malformed keys", () => {
    const load = () =>
      loadApiConfig({ ...api, JWT_SECRET: "short", HASH_SECRET: "short", TOTP_ENCRYPTION_KEY: "abc" });

    expect(load).toThrow(/JWT_SECRET must be at least 32 characters/);
    expect(load).toThrow(/HASH_SECRET must be at least 32 characters/);
    expect(load).toThrow(/TOTP_ENCRYPTION_KEY: Must be 32 bytes/);
  });

  it("rejects ICE URLs with the wrong scheme", () => {
    expect(() => loadApiConfig({ ...api, TURN_URLS: "http://turn.example" })).toThrow(/Use turn: URLs/);
  });

  it("lists every missing setting at once", () => {
    const load = () => loadApiConfig({ CORS_ALLOWED_ORIGINS: "not-a-url" });

    expect(load).toThrow(ConfigError);
    for (const name of ["MONGO_URI", "REDIS_URL", "RABBITMQ_URL", "CORS_ALLOWED_ORIGINS", "JWT_SECRET"]) {
      expect(load).toThrow(new RegExp(name));
    }
  });
});

describe("loadWorkersConfig", () => {
  it("needs SMTP but no API secrets, and defaults to port 8081", () => {
    const config = loadWorkersConfig(workers);

    expect(config.port).toBe(8081);
    expect(config.smtp).toMatchObject({ host: "mailpit", port: 1025, secure: false });
  });

  it("requires an SMTP host", () => {
    expect(() => loadWorkersConfig(infrastructure)).toThrow(/SMTP_HOST/);
  });
});

describe("loadSeedConfig", () => {
  it("needs only the infrastructure settings", () => {
    const config = loadSeedConfig(infrastructure);
    expect(config.mongo.uri).toBe("mongodb://localhost:27017");
    expect(config).toMatchObject({ adminEmail: "admin@parley.local", printCredentials: false });
  });
});

describe("free MVP billing configuration", () => {
  it("requires no merchant credentials with the default disabled provider", () => {
    expect(loadApiConfig({ ...api, NODE_ENV: "production" }).billing).toEqual({
      provider: "none",
      mockSecret: undefined,
      priceMinor: 999,
    });
  });
  it("refuses mock billing in production even with a valid test secret", () => {
    expect(() =>
      loadApiConfig({
        ...api,
        NODE_ENV: "production",
        PAYMENT_PROVIDER: "mock",
        MOCK_PAYMENT_WEBHOOK_SECRET: "s".repeat(32),
      }),
    ).toThrow("forbidden");
  });
});
