import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { UniqueConstraintViolationError } from "../../src/application/abstractions/persistence/errors.js";
import { EmailRequested } from "../../src/application/features/identity/events.js";
import { SendRequestedEmail } from "../../src/application/features/notifications/send-requested-email.js";
import type { EmailMessage } from "../../src/application/features/notifications/email-templates.js";
import { acceptTerms } from "../../src/domain/identity/terms-acceptance.js";
import { User } from "../../src/domain/identity/user.js";
import { RedisRateLimiter } from "../../src/infrastructure/caching/redis-rate-limiter.js";
import {
  MongoOneTimeTokenStore,
  MongoRefreshTokenStore,
  TOKEN_INDEXES,
} from "../../src/infrastructure/identity/mongo-token-stores.js";
import { createInfrastructure, type Infrastructure } from "../../src/infrastructure/infrastructure.js";
import { RabbitMqConsumer } from "../../src/infrastructure/messaging/rabbitmq-consumer.js";
import { applyMongoIndexes } from "../../src/infrastructure/persistence/mongo/mongo-indexes.js";
import {
  MongoUserRepository,
  USER_INDEXES,
} from "../../src/infrastructure/persistence/mongo/user-repository.js";
import { silentLogger, testInfrastructureConfig, waitFor } from "./support.js";

const session = {
  familyId: "family-1",
  subject: { kind: "user" as const, id: "user-1" },
  deviceId: "device-1",
  mfa: false,
};

describe("identity persistence and messaging", () => {
  let infrastructure: Infrastructure;

  beforeAll(async () => {
    infrastructure = await createInfrastructure(testInfrastructureConfig(), silentLogger, "identity-tests");
    await applyMongoIndexes(infrastructure.database, [USER_INDEXES, ...TOKEN_INDEXES], silentLogger);
    await waitFor(() => infrastructure.rabbitMq.isConnected);
  });

  afterAll(async () => {
    await infrastructure.database.dropDatabase();
    await infrastructure.close();
  });

  describe("MongoRefreshTokenStore", () => {
    it("stores only a hash of the token", async () => {
      const store = new MongoRefreshTokenStore(infrastructure.database, 60_000);
      const issued = await store.issue(session);

      const raw = await infrastructure.database
        .collection("refresh_tokens")
        .findOne({ _id: issued.token as never });
      expect(raw).toBeNull();
      expect(await infrastructure.database.collection("refresh_tokens").countDocuments()).toBeGreaterThan(0);
    });

    it("rotates once and rejects a concurrent second use without revoking (grace window)", async () => {
      const store = new MongoRefreshTokenStore(infrastructure.database, 60_000);
      const issued = await store.issue({ ...session, familyId: "family-rotate" });

      const [first, second] = await Promise.all([store.rotate(issued.token), store.rotate(issued.token)]);
      const statuses = [first.status, second.status].sort();

      expect(statuses).toEqual(["invalid", "rotated"]);
      const rotated = first.status === "rotated" ? first : second;
      if (rotated.status !== "rotated") return;
      expect(rotated.session).toEqual({ ...session, familyId: "family-rotate" });
      expect((await store.rotate(rotated.refreshToken.token)).status).toBe("rotated");
    });

    it("revokes the whole family when an old token is replayed after the grace window", async () => {
      const store = new MongoRefreshTokenStore(infrastructure.database, 60_000);
      const issued = await store.issue({ ...session, familyId: "family-reuse" });
      const rotated = await store.rotate(issued.token);
      if (rotated.status !== "rotated") throw new Error("setup");
      await infrastructure.database
        .collection("refresh_tokens")
        .updateMany(
          { familyId: "family-reuse", usedAt: { $ne: null } },
          { $set: { usedAt: new Date(Date.now() - 60_000) } },
        );

      expect((await store.rotate(issued.token)).status).toBe("reused");
      expect((await store.rotate(rotated.refreshToken.token)).status).toBe("invalid");
    });

    it("rejects expired tokens", async () => {
      const store = new MongoRefreshTokenStore(infrastructure.database, -1000);
      const issued = await store.issue({ ...session, familyId: "family-expired" });

      expect((await store.rotate(issued.token)).status).toBe("invalid");
    });

    it("revokes all sessions of a subject", async () => {
      const store = new MongoRefreshTokenStore(infrastructure.database, 60_000);
      const subject = { kind: "user" as const, id: "user-revoke" };
      const a = await store.issue({ ...session, subject, familyId: "a" });
      const b = await store.issue({ ...session, subject, familyId: "b" });

      await store.revokeAllForSubject("user-revoke");

      expect((await store.rotate(a.token)).status).toBe("invalid");
      expect((await store.rotate(b.token)).status).toBe("invalid");
    });
  });

  describe("MongoOneTimeTokenStore", () => {
    it("consumes a token once, for its purpose only", async () => {
      const store = new MongoOneTimeTokenStore(infrastructure.database);
      const token = await store.create("verify-email", "user-1", 60_000);

      expect(await store.consume("reset-password", token)).toBeNull();
      expect(await store.consume("verify-email", token)).toBe("user-1");
      expect(await store.consume("verify-email", token)).toBeNull();
    });

    it("rejects expired tokens", async () => {
      const store = new MongoOneTimeTokenStore(infrastructure.database);
      const token = await store.create("reset-password", "user-1", -1000);
      expect(await store.consume("reset-password", token)).toBeNull();
    });
  });

  describe("MongoUserRepository", () => {
    it("enforces unique emails", async () => {
      const users = new MongoUserRepository(infrastructure.database);
      const now = new Date();
      await users.add(User.register("dup@example.com", "hash", acceptTerms("v1", now), now));

      await expect(
        users.add(User.register("DUP@example.com", "hash", acceptTerms("v1", now), now)),
      ).rejects.toBeInstanceOf(UniqueConstraintViolationError);
    });

    it("round-trips every field", async () => {
      const users = new MongoUserRepository(infrastructure.database);
      const now = new Date("2026-10-25T10:00:00Z");
      const user = User.createStaff("staff@example.com", "hash", ["Admin"], now);
      user.startTwoFactorEnrollment("encrypted");
      user.enableTwoFactor(["h1"], now);
      await users.add(user);

      const loaded = await users.findByEmail("staff@example.com");

      expect(loaded?.roles).toEqual(["Admin"]);
      expect(loaded?.isTwoFactorEnabled).toBe(true);
      expect(loaded?.twoFactor?.recoveryCodeHashes).toEqual(["h1"]);
      expect(loaded?.emailVerifiedAt).toEqual(now);
    });
  });

  describe("RedisRateLimiter", () => {
    it("allows up to the limit within the window, then reports retry-after", async () => {
      const limiter = new RedisRateLimiter(infrastructure.redis, `rl-test-${Date.now()}`);

      const decisions = [];
      for (let attempt = 0; attempt < 4; attempt += 1) decisions.push(await limiter.consume("ip-1", 3, 1000));

      expect(decisions.map((decision) => decision.allowed)).toEqual([true, true, true, false]);
      expect(decisions[2]?.remaining).toBe(0);
      expect(decisions[3]?.retryAfterMs).toBeGreaterThan(0);
      expect(decisions[3]?.retryAfterMs).toBeLessThanOrEqual(1000);
    });

    it("slides: requests are allowed again once the window passes", async () => {
      const limiter = new RedisRateLimiter(infrastructure.redis, `rl-slide-${Date.now()}`);
      await limiter.consume("ip-2", 1, 200);
      expect((await limiter.consume("ip-2", 1, 200)).allowed).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 250));
      expect((await limiter.consume("ip-2", 1, 200)).allowed).toBe(true);
    });

    it("keeps separate buckets per key", async () => {
      const limiter = new RedisRateLimiter(infrastructure.redis, `rl-keys-${Date.now()}`);
      await limiter.consume("a", 1, 1000);
      expect((await limiter.consume("b", 1, 1000)).allowed).toBe(true);
    });
  });

  describe("email pipeline", () => {
    it("delivers an EmailRequested event to the sender through RabbitMQ", async () => {
      const sent: EmailMessage[] = [];
      const consumer = new RabbitMqConsumer(
        infrastructure.rabbitMq,
        {
          subscriber: `email-test-${Date.now()}`,
          definition: EmailRequested,
          handler: new SendRequestedEmail({
            send: (message) => {
              sent.push(message);
              return Promise.resolve();
            },
          }),
          prefetch: 4,
          deliveryLimit: 2,
          retryDelayMs: 10,
        },
        silentLogger,
      );
      await consumer.start();

      await infrastructure.eventPublisher.publish(EmailRequested, {
        to: "ada@example.com",
        template: "password-reset",
        link: "http://localhost:3000/reset-password?token=abc",
      });

      await waitFor(() => sent.length === 1);
      expect(sent[0]).toMatchObject({ to: "ada@example.com", subject: "Reset your Parley password" });
      expect(z.string().parse(sent[0]?.text)).toContain("reset-password?token=abc");
      await consumer.stop();
    });
  });
});
