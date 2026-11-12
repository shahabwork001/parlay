import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPageRequest } from "../../src/application/common/paging.js";
import { User } from "../../src/domain/identity/user.js";
import { Ban } from "../../src/domain/moderation/ban.js";
import { Report, type ReportCategory } from "../../src/domain/moderation/report.js";
import { MongoAdminReadModel } from "../../src/infrastructure/admin/mongo-admin-read-model.js";
import { RedisLiveStats } from "../../src/infrastructure/admin/redis-live-stats.js";
import { MongoRefreshTokenStore } from "../../src/infrastructure/identity/mongo-token-stores.js";
import { createInfrastructure, type Infrastructure } from "../../src/infrastructure/infrastructure.js";
import { RabbitMqQueueInspector } from "../../src/infrastructure/messaging/queue-inspector.js";
import { MongoAuditLog } from "../../src/infrastructure/moderation/mongo-audit-log.js";
import { MongoBanRepository } from "../../src/infrastructure/moderation/mongo-ban-repository.js";
import { MongoReportRepository } from "../../src/infrastructure/moderation/mongo-report-repository.js";
import { MongoUserRepository } from "../../src/infrastructure/persistence/mongo/user-repository.js";
import { silentLogger, testInfrastructureConfig, waitFor } from "./support.js";

const HOUR = 60 * 60_000;
const party = (subjectId: string, kind: "user" | "anonymous" = "anonymous") => ({
  subjectId,
  deviceId: `device-${subjectId}`,
  kind,
  networkHash: "n",
  subnetHash: "s",
});

describe("admin read model", () => {
  let infrastructure: Infrastructure;
  let readModel: MongoAdminReadModel;
  const now = new Date();
  const page = createPageRequest(1, 20);

  beforeAll(async () => {
    infrastructure = await createInfrastructure(testInfrastructureConfig(), silentLogger, "admin-tests");
    readModel = new MongoAdminReadModel(infrastructure.database);
  });

  afterAll(async () => {
    await infrastructure.close();
  });

  async function report(category: ReportCategory, reporter: string, reported: string, createdAt = now) {
    const created = Report.submit(
      {
        sessionId: randomUUID(),
        mode: "text",
        category,
        note: null,
        reporter: party(reporter),
        reported: party(reported, "user"),
        evidenceId: null,
      },
      createdAt,
    );
    await new MongoReportRepository(infrastructure.database).add(created);
    return created;
  }

  it("orders the open queue by priority then age, and counts history", async () => {
    const reports = new MongoReportRepository(infrastructure.database);
    const old = await report("spam", "r1", "target", new Date(now.getTime() - 2 * HOUR));
    const urgent = await report("appears-minor", "r2", "target");
    const recentSpam = await report("spam", "r3", "target");
    const resolved = await report("harassment", "r1", "other");
    resolved.resolve("warned", "mod", null, now);
    await reports.update(resolved);
    const dismissed = await report("other", "r1", "target");
    dismissed.resolve("dismissed", "mod", null, now);
    await reports.update(dismissed);

    const open = await readModel.listReports({ status: "open", reportedSubjectId: "target", page });
    expect(open.items.map((item) => item.id)).toEqual([urgent.id, old.id, recentSpam.id]);
    expect(open.items[0]).toMatchObject({ tier: "critical", escalation: "required", hasEvidence: false });
    const oldestFirst = await readModel.listReports({
      status: "open",
      sort: "oldest",
      reportedSubjectId: "target",
      page,
    });
    expect(oldestFirst.items[0]?.id).toBe(old.id);
    const done = await readModel.listReports({ status: "resolved", page });
    expect(done.items.find((item) => item.id === resolved.id)?.outcome).toBe("warned");

    expect(await readModel.reportCounts("target", now)).toEqual({ total: 4, upheld: 0, lastDay: 4 });
    expect(await readModel.reportCounts("other", now)).toMatchObject({ upheld: 1 });
    expect(await readModel.filedCounts("r1")).toEqual({ total: 3, dismissed: 1 });
    expect((await readModel.openReportsByTier()).critical).toBeGreaterThanOrEqual(1);
    const perHour = await readModel.reportsPerHour(24, now);
    expect(perHour).toHaveLength(24);
    expect(perHour[23]).toBeGreaterThanOrEqual(4);
    expect(perHour[21]).toBeGreaterThanOrEqual(1);
  });

  it("filters bans by activity, pending appeals and target", async () => {
    const bans = new MongoBanRepository(infrastructure.database);
    const target = randomUUID();
    const active = Ban.issue(
      { targets: [{ kind: "account", value: target }], mode: "full", reason: "spam", source: "moderator" },
      now,
    );
    active.submitAppeal("I would like a second look, please.", now);
    const expired = Ban.issue(
      {
        targets: [{ kind: "account", value: target }],
        mode: "full",
        reason: "spam",
        source: "automatic",
        durationMs: 1,
      },
      new Date(now.getTime() - HOUR),
    );
    await bans.add(active);
    await bans.add(expired);

    const all = await readModel.listBans({ filter: "all", targetValue: target, page }, now);
    expect(all.totalCount).toBe(2);
    const current = await readModel.listBans({ filter: "active", targetValue: target, page }, now);
    expect(current.items.map((ban) => ban.id)).toEqual([active.id]);
    const appeals = await readModel.listBans({ filter: "appeals", targetValue: target, page }, now);
    expect(appeals.items[0]?.appeal?.status).toBe("pending");
    expect(await readModel.pendingAppeals()).toBeGreaterThanOrEqual(1);
  });

  it("searches accounts, lists staff and summarises sign-in sessions", async () => {
    const users = new MongoUserRepository(infrastructure.database);
    const staff = User.createStaff(`mod-${randomUUID().slice(0, 6)}@example.com`, "hash", ["Moderator"], now);
    await users.add(staff);

    const found = await readModel.searchUsers(staff.email.slice(0, 10).toUpperCase(), page);
    expect(found.items.map((item) => item.id)).toContain(staff.id);
    expect((await readModel.searchUsers(staff.id, page)).items[0]?.email).toBe(staff.email);
    expect((await readModel.searchUsers("(unbalanced[", page)).totalCount).toBe(0);
    expect((await readModel.listStaff()).map((item) => item.id)).toContain(staff.id);
    const byEmail = await readModel.searchUsers("", page, "email");
    const emails = byEmail.items.map((item) => item.email);
    expect(emails).toEqual([...emails].sort());

    const tokens = new MongoRefreshTokenStore(infrastructure.database, 30 * 24 * HOUR);
    const issued = await tokens.issue({
      familyId: "fam-1",
      subject: { kind: "user", id: staff.id },
      deviceId: "dev-1",
      mfa: true,
    });
    await tokens.rotate(issued.token);
    const sessions = await readModel.userSessions(staff.id, new Date());
    expect(sessions).toEqual([
      expect.objectContaining({ familyId: "fam-1", deviceId: "dev-1", mfa: true, active: true }),
    ]);
  });

  it("lists audit entries newest first with filters", async () => {
    const audit = new MongoAuditLog(infrastructure.database);
    const target = randomUUID();
    for (const [index, action] of ["ban.lifted", "report.decided"].entries())
      await audit.record({
        actor: { kind: "staff", subjectId: "mod-1", roles: ["Moderator"] },
        action,
        target: { type: "report", id: target },
        at: new Date(now.getTime() + index),
      });

    const entries = await readModel.listAudit({ targetId: target, page });
    expect(entries.items.map((entry) => entry.action)).toEqual(["report.decided", "ban.lifted"]);
    const oldest = await readModel.listAudit({ targetId: target, order: "oldest", page });
    expect(oldest.items.map((entry) => entry.action)).toEqual(["ban.lifted", "report.decided"]);
    expect((await readModel.listAudit({ targetId: target, action: "ban.lifted", page })).totalCount).toBe(1);
  });

  it("counts live matchmaking state and match throughput in Redis", async () => {
    const prefix = `mm-stats-${randomUUID()}`;
    const stats = new RedisLiveStats(infrastructure.redis, prefix);
    await infrastructure.redis.set(`${prefix}:presence:a`, "1");
    await infrastructure.redis.set(`${prefix}:presence:b`, "1");
    await infrastructure.redis.zadd(`${prefix}:queue:video:standard`, 1, "a");
    await infrastructure.redis.zadd(`${prefix}:queue:video:shadow`, 1, "c");
    await infrastructure.redis.sadd(`${prefix}:sessions`, "s1");
    const minute = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 5_000_000_000);
    await stats.recordMatch(1000, minute);
    await stats.recordMatch(3000, minute);

    expect(await stats.online()).toBe(2);
    expect(await stats.waiting()).toEqual({ text: 0, video: 2 });
    expect(await stats.activeSessions()).toBe(1);
    const series = await stats.matchesPerMinute(60, minute);
    expect(series).toHaveLength(60);
    expect(series.at(-1)).toBe(2);
    expect(await stats.averageWaitMs(15, minute)).toBe(2000);
    expect(await stats.averageWaitMs(15, new Date(minute.getTime() + 60 * 60_000))).toBeNull();
  });

  it("reports queue depths, including queues that do not exist yet", async () => {
    await waitFor(() => infrastructure.rabbitMq.isConnected);
    const channel = await infrastructure.rabbitMq.createChannel();
    const queue = `parley.test-${randomUUID()}`;
    await channel.assertQueue(queue);
    channel.sendToQueue(queue, Buffer.from("x"));
    await channel.close();

    const inspector = new RabbitMqQueueInspector(infrastructure.rabbitMq, [queue, "parley.missing.queue"]);
    await waitFor(async () => (await inspector.depths())[0]?.messages === 1);
    expect(await inspector.depths()).toEqual([
      { queue, messages: 1, consumers: 0 },
      { queue: `${queue}.dead-letter`, messages: 0, consumers: 0 },
      { queue: "parley.missing.queue", messages: 0, consumers: 0 },
      { queue: "parley.missing.queue.dead-letter", messages: 0, consumers: 0 },
    ]);
  });
});
