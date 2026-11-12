import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Ban } from "../../src/domain/moderation/ban.js";
import { Report } from "../../src/domain/moderation/report.js";
import { createInfrastructure, type Infrastructure } from "../../src/infrastructure/infrastructure.js";
import { MongoAuditLog } from "../../src/infrastructure/moderation/mongo-audit-log.js";
import { MongoBanRepository } from "../../src/infrastructure/moderation/mongo-ban-repository.js";
import { MongoEvidenceStore } from "../../src/infrastructure/moderation/mongo-evidence-store.js";
import { MongoReportRepository } from "../../src/infrastructure/moderation/mongo-report-repository.js";
import { RedisBanCache } from "../../src/infrastructure/moderation/redis-ban-cache.js";
import { RedisEventCounter } from "../../src/infrastructure/moderation/redis-event-counter.js";
import { MongoTextRulesProvider } from "../../src/infrastructure/moderation/text-rules-store.js";
import { CachedTrustStore } from "../../src/infrastructure/moderation/trust-store.js";
import { DEFAULT_TEXT_RULES } from "../../src/domain/moderation/text-rules.js";
import { silentLogger, testInfrastructureConfig, waitFor } from "./support.js";

const HOUR = 60 * 60_000;
const party = (subjectId: string) => ({
  subjectId,
  deviceId: `device-${subjectId}`,
  kind: "anonymous" as const,
  networkHash: "n",
  subnetHash: "s",
});

describe("moderation stores", () => {
  let infrastructure: Infrastructure;

  beforeAll(async () => {
    infrastructure = await createInfrastructure(testInfrastructureConfig(), silentLogger, "moderation-tests");
  });

  afterAll(async () => {
    await infrastructure.close();
  });

  it("finds active bans by any target and keeps the Redis cache in step", async () => {
    const repository = new MongoBanRepository(infrastructure.database);
    const cache = new RedisBanCache(infrastructure.redis, `ban-test-${randomUUID()}`);
    const now = new Date();
    const device = { kind: "device" as const, value: randomUUID() };
    const temporary = Ban.issue(
      { targets: [device], mode: "full", reason: "spam", source: "automatic", durationMs: HOUR },
      now,
    );
    const expired = Ban.issue(
      { targets: [device], mode: "shadow", reason: "spam", source: "automatic", durationMs: 1 },
      new Date(now.getTime() - HOUR),
    );
    for (const ban of [temporary, expired]) {
      await repository.add(ban);
      await cache.store(ban, now);
    }

    expect(
      (await repository.findActive([{ kind: "ip", value: "x" }, device], now)).map((ban) => ban.id),
    ).toEqual([temporary.id]);
    expect(await cache.lookup([device], now)).toEqual([{ banId: temporary.id, mode: "full" }]);
    expect(await cache.lookup([device], new Date(now.getTime() + HOUR))).toEqual([]);

    temporary.lift("moderator", now);
    await repository.update(temporary);
    await cache.remove(temporary);
    expect(await repository.findActive([device], now)).toEqual([]);
    expect(await cache.lookup([device], now)).toEqual([]);
  });

  it("counts reports against someone and their distinct reporters; one report per chat and reporter", async () => {
    const reports = new MongoReportRepository(infrastructure.database);
    await waitFor(
      async () =>
        (
          await infrastructure.database
            .collection("reports")
            .indexes()
            .catch(() => [])
        ).length > 1,
    );
    const sessionId = randomUUID();
    const now = new Date();
    const submit = (reporter: string, session = randomUUID()) =>
      Report.submit(
        {
          sessionId: session,
          mode: "text",
          category: "spam",
          note: null,
          reporter: party(reporter),
          reported: party("target"),
          evidenceId: null,
        },
        now,
      );

    await reports.add(submit("r1", sessionId));
    await reports.add(submit("r1"));
    await reports.add(submit("r2"));
    await expect(reports.add(submit("r1", sessionId))).rejects.toThrow();

    expect(await reports.existsForSession(sessionId, "r1")).toBe(true);
    expect(await reports.countAgainst("target", new Date(now.getTime() - 1000))).toEqual({
      reports: 3,
      distinctReporters: 2,
    });
  });

  it("stores evidence with a retention TTL index and hides expired evidence", async () => {
    const store = new MongoEvidenceStore(infrastructure.database);
    const now = new Date();
    const id = randomUUID();
    await store.save({
      id,
      reportId: "r",
      snapshot: { contentType: "image/jpeg", data: Buffer.from([0xff, 0xd8, 0xff]) },
      messages: [],
      createdAt: now,
      expiresAt: new Date(now.getTime() + HOUR),
    });
    await store.save({
      id: `${id}-old`,
      reportId: "r",
      snapshot: null,
      messages: [],
      createdAt: now,
      expiresAt: new Date(now.getTime() - 1),
    });

    expect((await store.get(id))?.snapshot?.data).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(await store.get(`${id}-old`)).toBeNull();
    await waitFor(async () =>
      (
        await infrastructure.database
          .collection("evidence")
          .indexes()
          .catch(() => [])
      ).some((index) => index.expireAfterSeconds === 0),
    );
  });

  it("clamps trust adjustments and serves scores through the cache", async () => {
    const trust = new CachedTrustStore(infrastructure.database, infrastructure.redis);
    const key = `device:${randomUUID()}`;

    expect(await trust.scoreOf([key])).toBe(50);
    await trust.adjust([key], -80);
    expect(await trust.scoreOf([key])).toBe(0);
    await trust.adjust([key], 7);
    expect(await trust.scoreOf([key, `user:${randomUUID()}`])).toBe(7);
  });

  it("writes event-derived audit entries once", async () => {
    const audit = new MongoAuditLog(infrastructure.database);
    const entry = {
      id: randomUUID(),
      actor: { kind: "system" as const, subjectId: null, roles: [] },
      action: "ban.issued",
      target: { type: "ban", id: "b" },
      at: new Date(),
    };
    await audit.record(entry);
    await audit.record(entry);
    expect(
      await infrastructure.database.collection("audit_log").countDocuments({ _id: entry.id as never }),
    ).toBe(1);
  });

  it("seeds text rules and counts events in a sliding window", async () => {
    expect(await new MongoTextRulesProvider(infrastructure.database).current()).toEqual(DEFAULT_TEXT_RULES);

    let now = 1_000_000;
    const counter = new RedisEventCounter(infrastructure.redis, () => now);
    const key = randomUUID();
    expect(await counter.increment(key, 1000)).toBe(1);
    expect(await counter.increment(key, 1000)).toBe(2);
    now += 1500;
    expect(await counter.increment(key, 1000)).toBe(1);
  });
});
