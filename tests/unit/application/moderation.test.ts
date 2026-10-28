import { describe, expect, it } from "vitest";
import type { ChatSession } from "../../../src/application/features/chat/chat-types.js";
import { GetMyBan, SubmitAppeal } from "../../../src/application/features/moderation/bans.js";
import { RecordContentFlag } from "../../../src/application/features/moderation/content-flags.js";
import { GetReportEvidence } from "../../../src/application/features/moderation/evidence-access.js";
import { banTargetsFor, subnetOf } from "../../../src/application/features/moderation/network.js";
import { SubmitReport } from "../../../src/application/features/moderation/reports.js";
import { ScoreReport } from "../../../src/application/features/moderation/scoring.js";
import {
  CONTACT_PLACEHOLDER,
  LINK_PLACEHOLDER,
  moderateText,
  RepeatGuard,
} from "../../../src/application/features/moderation/text-moderation.js";
import {
  PenaliseFlaggedContent,
  RewardCleanSession,
} from "../../../src/application/features/moderation/trust-handlers.js";
import type { Principal } from "../../../src/application/features/identity/ports.js";
import { MAX_MESSAGE_LENGTH } from "../../../src/application/features/chat/schemas.js";
import { DEFAULT_TEXT_RULES } from "../../../src/domain/moderation/text-rules.js";
import {
  createModerationFakes,
  FixedClassifier,
  identityOf,
  participant,
  unlimited,
} from "../../support/moderation-fakes.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const HOUR = 60 * 60_000;
const rules = DEFAULT_TEXT_RULES;

describe("moderateText", () => {
  const ok = (raw: string, strict = false) => {
    const result = moderateText(raw, rules, { strict });
    if (result.status !== "ok") throw new Error(`expected ok, got ${result.status}`);
    return result;
  };

  it("leaves clean text untouched apart from trimming", () => {
    expect(ok("  hello there, how are you?  ")).toEqual({
      status: "ok",
      text: "hello there, how are you?",
      masked: false,
      removed: [],
    });
  });

  it("masks profanity with bullets of the same length, including leetspeak and stretching", () => {
    expect(ok("what the FUCK is this sh1t").text).toBe("what the •••• is this ••••");
    expect(ok("fuuuuck").text).toBe("•••••••");
    expect(ok("Scunthorpe assessment").masked).toBe(false);
  });

  it("rejects messages with slurs, and profanity too in strict mode", () => {
    expect(moderateText("you f4ggot", rules, { strict: false }).status).toBe("blocked");
    expect(moderateText("oh shit", rules, { strict: true }).status).toBe("blocked");
    expect(moderateText("   ", rules, { strict: false }).status).toBe("empty");
  });

  it("removes links, phone numbers and social handles", () => {
    expect(ok("see www.example.org").text).toBe(`see ${LINK_PLACEHOLDER}`);
    expect(ok("call +1 (555) 123-4567").text).toBe(`call ${CONTACT_PLACEHOLDER}`);
    expect(ok("dm @night_owl").text).toBe(`dm ${CONTACT_PLACEHOLDER}`);
    expect(ok("my insta is jane.doe").text).toBe(`my ${CONTACT_PLACEHOLDER}`);
    expect(ok("snap: jane").removed).toEqual(["handle"]);
  });

  it("keeps ordinary numbers and platform names in conversation", () => {
    expect(ok("I was born in 1999 and have 2 cats").removed).toEqual([]);
    expect(ok("oh snap is fun").text).toBe("oh snap is fun");
    expect(ok("email me at someone@example.com").text).not.toContain("someone@");
  });

  it("honours disabled rules and caps the length", () => {
    expect(ok("a".repeat(MAX_MESSAGE_LENGTH + 50)).text).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(
      moderateText("www.example.org", { ...rules, removeLinks: false }, { strict: false }),
    ).toMatchObject({
      text: "www.example.org",
    });
  });
});

describe("RepeatGuard", () => {
  it("flags the same message beyond the allowed repeats within the window", () => {
    const guard = new RepeatGuard();
    const results = [0, 1, 2, 3].map((second) => guard.isSpam(" Buy  NOW ", second * 1000, rules));
    expect(results).toEqual([false, false, false, true]);
    expect(guard.isSpam("buy now", 60_000, rules)).toBe(false);
  });
});

describe("network identity", () => {
  it("groups addresses into /24 and /64 subnets", () => {
    expect(subnetOf("203.0.113.77")).toBe("203.0.113.0/24");
    expect(subnetOf("::ffff:203.0.113.77")).toBe("203.0.113.0/24");
    expect(subnetOf("2001:db8:0:12::1")).toBe("2001:db8:0:12::/64");
    expect(subnetOf("2001:db8::")).toBe("2001:db8:0:0::/64");
  });

  it("targets account, device and network for checks", () => {
    const kinds = banTargetsFor(identityOf(participant("u", "user"))).map((target) => target.kind);
    expect(kinds).toEqual(["account", "device", "ip", "subnet"]);
  });
});

describe("BanService", () => {
  it("writes through to the cache, enforces full bans and announces them", async () => {
    const fakes = createModerationFakes();
    const who = identityOf(participant("p"));

    const ban = await fakes.banService.issue({
      targets: [{ kind: "device", value: who.deviceId }],
      mode: "full",
      reason: "harassment",
      source: "moderator",
      durationMs: HOUR,
    });

    expect(await fakes.banService.checkAccess(who)).toEqual({ status: "banned", banId: ban.id });
    expect(fakes.enforcer.enforced).toHaveLength(1);
    expect(fakes.events.published.map((event) => event.routingKey)).toEqual(["moderation.ban-issued.v1"]);
    fakes.advance(HOUR);
    expect(await fakes.banService.checkAccess(who)).toEqual({ status: "allowed" });
  });

  it("keeps shadow bans silent and lifts bans", async () => {
    const fakes = createModerationFakes();
    const who = identityOf(participant("p"));
    const ban = await fakes.banService.issue({
      targets: [{ kind: "subnet", value: who.subnetHash }],
      mode: "shadow",
      reason: "spam",
      source: "moderator",
    });

    expect(await fakes.banService.checkAccess(who)).toEqual({ status: "shadow" });
    expect(fakes.enforcer.enforced).toHaveLength(0);
    expect((await fakes.banService.lift(ban.id, "mod")).ok).toBe(true);
    expect(await fakes.banService.checkAccess(who)).toEqual({ status: "allowed" });
  });

  it("does not stack automatic bans on someone already banned", async () => {
    const fakes = createModerationFakes();
    const targets = [{ kind: "device" as const, value: "d" }];
    expect(await fakes.banService.issueAutomatic(targets, "repeated-flags", HOUR)).not.toBeNull();
    expect(await fakes.banService.issueAutomatic(targets, "repeated-flags", HOUR)).toBeNull();
  });

  it("rebuilds the cache from the repository", async () => {
    const fakes = createModerationFakes();
    await fakes.banService.issue({
      targets: [{ kind: "device", value: "d" }],
      mode: "full",
      reason: "spam",
      source: "moderator",
    });
    expect(await fakes.banService.warmCache()).toBe(1);
  });
});

describe("ban notice and appeals", () => {
  it("shows the most severe full ban and accepts one appeal", async () => {
    const fakes = createModerationFakes();
    const who = identityOf(participant("p", "user"));
    await fakes.banService.issue({
      targets: [{ kind: "account", value: who.subjectId }],
      mode: "full",
      reason: "spam",
      source: "automatic",
      durationMs: HOUR,
    });
    const permanent = await fakes.banService.issue({
      targets: [{ kind: "device", value: who.deviceId }],
      mode: "full",
      reason: "hate",
      source: "moderator",
    });
    await fakes.banService.issue({
      targets: [{ kind: "ip", value: who.networkHash }],
      mode: "shadow",
      reason: "spam",
      source: "moderator",
    });

    const view = await new GetMyBan(fakes.bans, fakes.clock).execute(who);
    expect(view).toMatchObject({
      id: permanent.id,
      reason: "hate",
      expiresAt: null,
      appealable: true,
      appeal: null,
    });

    const appeal = new SubmitAppeal(fakes.bans, fakes.clock);
    const first = await appeal.execute(who, "I think this was a mistake, please look again.");
    expect(first.ok && first.value.appeal?.status).toBe("pending");
    expect(first.ok && first.value.appealable).toBe(false);
    const second = await appeal.execute(who, "Second try at an appeal for the same ban.");
    expect(!second.ok && second.error.code).toBe("ban.appeal_exists");
  });

  it("reports no ban for shadow-banned people", async () => {
    const fakes = createModerationFakes();
    const who = identityOf(participant("p"));
    await fakes.banService.issue({
      targets: [{ kind: "device", value: who.deviceId }],
      mode: "shadow",
      reason: "spam",
      source: "moderator",
    });
    expect(await new GetMyBan(fakes.bans, fakes.clock).execute(who)).toBeNull();
    const appeal = await new SubmitAppeal(fakes.bans, fakes.clock).execute(who, "x".repeat(25));
    expect(!appeal.ok && appeal.error.code).toBe("ban.not_found");
  });
});

function reportSetup() {
  const fakes = createModerationFakes();
  const reporter = participant("reporter");
  const reported = participant("reported", "user");
  const session: ChatSession = {
    sessionId: "0199f000-0000-7000-8000-000000000001",
    mode: "video",
    caller: reporter,
    callee: reported,
    sharedInterests: [],
    startedAt: fakes.clock(),
  };
  fakes.matchmaker.sessions.set(session.sessionId, session);
  const ended: string[] = [];
  const submit = new SubmitReport({
    matchmaker: fakes.matchmaker,
    sessions: {
      endIfActive: (subjectId) => {
        ended.push(subjectId);
        return Promise.resolve();
      },
    },
    recentMessages: fakes.recentMessages,
    reports: fakes.reports,
    evidence: fakes.evidence,
    bans: fakes.banService,
    rateLimiter: unlimited,
    events: fakes.events,
    policy: fakes.policy,
    clock: fakes.clock,
  });
  return { fakes, reporter, reported, session, ended, submit };
}

describe("SubmitReport", () => {
  it("ends the chat, blocks the partner and stores evidence with the retention deadline", async () => {
    const { fakes, reporter, reported, session, ended, submit } = reportSetup();
    await fakes.recentMessages.append(session.sessionId, {
      senderSubjectId: reported.subjectId,
      text: "rude",
      sentAt: fakes.clock(),
    });

    const result = await submit.execute({
      reporter: identityOf(reporter),
      sessionId: session.sessionId,
      category: "harassment",
      note: "kept insulting me",
      snapshot: JPEG,
    });

    if (!result.ok) throw new Error(result.error.code);
    expect(ended).toEqual([reporter.subjectId]);
    expect(fakes.matchmaker.blocks).toEqual([[reporter, reported]]);
    const report = await fakes.reports.getById(result.value.reportId);
    expect(report).toMatchObject({
      category: "harassment",
      tier: "normal",
      reported: { networkHash: "net-reported" },
    });
    const evidence = await fakes.evidence.get(report!.evidenceId!);
    expect(evidence?.messages).toEqual([{ from: "reported", text: "rude", sentAt: fakes.clock() }]);
    expect(evidence?.expiresAt.getTime()).toBe(fakes.clock().getTime() + 30 * 24 * HOUR);
    expect(fakes.events.published.map((event) => event.routingKey)).toEqual([
      "chat.partner-blocked.v1",
      "moderation.report-submitted.v1",
    ]);
    expect(await fakes.banService.checkAccess(identityOf(reported))).toEqual({ status: "allowed" });
  });

  it("suspends the reported person at once for minor-safety reports and keeps evidence a year", async () => {
    const { fakes, reporter, session, submit } = reportSetup();

    const result = await submit.execute({
      reporter: identityOf(reporter),
      sessionId: session.sessionId,
      category: "child-sexual-content",
      note: null,
      snapshot: JPEG,
    });

    if (!result.ok) throw new Error(result.error.code);
    const report = await fakes.reports.getById(result.value.reportId);
    expect(report).toMatchObject({ tier: "critical", escalation: "required" });
    expect((await fakes.evidence.get(report!.evidenceId!))?.expiresAt.getTime()).toBe(
      fakes.clock().getTime() + 365 * 24 * HOUR,
    );
    const [ban] = fakes.bans.all();
    expect(ban).toMatchObject({ reason: "pending-review", expiresAt: null, reportId: report!.id });
    expect(ban!.targets.map((target) => target.kind)).toEqual(["account", "device"]);
  });

  it("rejects strangers to the session, duplicates, fake images and floods", async () => {
    const { reporter, session, submit } = reportSetup();
    const input = {
      reporter: identityOf(reporter),
      sessionId: session.sessionId,
      category: "spam" as const,
      note: null,
      snapshot: null,
    };

    const stranger = await submit.execute({ ...input, reporter: identityOf(participant("someone-else")) });
    expect(!stranger.ok && stranger.error.code).toBe("report.session_not_found");
    const notJpeg = await submit.execute({ ...input, snapshot: Buffer.from("not an image") });
    expect(!notJpeg.ok && notJpeg.error.code).toBe("report.invalid_snapshot");
    expect((await submit.execute(input)).ok).toBe(true);
    const duplicate = await submit.execute(input);
    expect(!duplicate.ok && duplicate.error.code).toBe("report.duplicate");
  });

  it("stores no evidence when there is nothing to keep", async () => {
    const { fakes, reporter, session, submit } = reportSetup();
    const result = await submit.execute({
      reporter: identityOf(reporter),
      sessionId: session.sessionId,
      category: "spam",
      note: null,
      snapshot: null,
    });
    expect(result.ok && (await fakes.reports.getById(result.value.reportId))?.evidenceId).toBeNull();
  });
});

describe("ScoreReport", () => {
  it("scores once, lowers trust and suspends after reports from several people", async () => {
    const { fakes, reported, session, submit } = reportSetup();
    const score = new ScoreReport({
      reports: fakes.reports,
      evidence: fakes.evidence,
      classifier: new FixedClassifier({ image: 0.8, text: null, labels: ["skin-exposure"] }),
      trust: fakes.trust,
      bans: fakes.banService,
      policy: fakes.policy,
      clock: fakes.clock,
    });

    const reporters = ["r1", "r2", "r3"].map((id) => participant(id));
    for (const [index, reporter] of reporters.entries()) {
      const sessionId = `0199f000-0000-7000-8000-00000000001${index}`;
      fakes.matchmaker.sessions.set(sessionId, { ...session, sessionId, caller: reporter });
      const result = await submit.execute({
        reporter: identityOf(reporter),
        sessionId,
        category: "nudity",
        note: null,
        snapshot: null,
      });
      if (!result.ok) throw new Error(result.error.code);
      const event = { eventId: `e${index}`, occurredAt: "", payload: { reportId: result.value.reportId } };
      await score.handle(event);
      await score.handle(event);
    }

    const scored = fakes.reports.all();
    expect(scored.every((report) => report.scoredAt !== null)).toBe(true);
    expect(scored[0]!.priority).toBe(60 + 16);
    expect(await fakes.trust.scoreOf(["user:reported"])).toBe(50 - 3 * 3);
    const [ban] = fakes.bans.all();
    expect(ban).toMatchObject({ reason: "repeated-reports", source: "automatic" });
    expect(ban!.expiresAt!.getTime() - fakes.clock().getTime()).toBe(24 * HOUR);
    expect(ban!.targets).toEqual([
      { kind: "account", value: reported.subjectId },
      { kind: "device", value: reported.deviceId },
    ]);
  });
});

describe("RecordContentFlag", () => {
  it("bans after repeated flags within the window, not before", async () => {
    const fakes = createModerationFakes();
    const flag = new RecordContentFlag(
      fakes.counter,
      fakes.banService,
      fakes.events,
      fakes.policy,
      fakes.clock,
    );
    const who = identityOf(participant("p"));

    expect(await flag.execute(who, 0.9)).toBe("recorded");
    fakes.advance(11 * 60_000);
    expect(await flag.execute(who, 0.9)).toBe("recorded");
    expect(await flag.execute(who, 0.9)).toBe("recorded");
    expect(await flag.execute(who, 0.9)).toBe("banned");
    expect(fakes.bans.all()[0]).toMatchObject({ reason: "repeated-flags" });
  });
});

describe("trust handlers", () => {
  it("rewards sessions of a minute or more and penalises flags", async () => {
    const fakes = createModerationFakes();
    const participants = [
      { subjectId: "a", deviceId: "a", kind: "anonymous" as const },
      { subjectId: "u", deviceId: "d", kind: "user" as const },
    ];
    const session = (durationMs: number) => ({
      eventId: "e",
      occurredAt: "",
      payload: {
        sessionId: "s",
        mode: "text" as const,
        startedAt: new Date(0).toISOString(),
        endedAt: new Date(durationMs).toISOString(),
        participants,
      },
    });

    await new RewardCleanSession(fakes.trust).handle(session(59_000));
    await new RewardCleanSession(fakes.trust).handle(session(60_000));
    await new PenaliseFlaggedContent(fakes.trust).handle({
      eventId: "f",
      occurredAt: "",
      payload: {
        ...participants[0]!,
        source: "nsfw-screening",
        score: 0.9,
        flaggedAt: new Date().toISOString(),
      },
    });

    expect(await fakes.trust.scoreOf(["device:a"])).toBe(46);
    expect(await fakes.trust.scoreOf(["user:u", "device:d"])).toBe(51);
  });
});

describe("GetReportEvidence", () => {
  const staff = (roles: Principal["roles"]): Principal => ({
    kind: "user",
    subjectId: "staff-1",
    deviceId: "staff-device",
    roles,
    emailVerified: true,
    mfa: true,
    termsVersion: "2026-10-25",
  });

  it("audits every access and restricts minor-safety evidence", async () => {
    const { fakes, reporter, session, submit } = reportSetup();
    const minor = await submit.execute({
      reporter: identityOf(reporter),
      sessionId: session.sessionId,
      category: "appears-minor",
      note: null,
      snapshot: JPEG,
    });
    if (!minor.ok) throw new Error(minor.error.code);
    const evidence = new GetReportEvidence(fakes.reports, fakes.evidence, fakes.audit, fakes.clock);

    const denied = await evidence.execute(staff(["Support"]), minor.value.reportId);
    expect(!denied.ok && denied.error.code).toBe("evidence.restricted");
    expect(fakes.audit.entries).toHaveLength(0);

    const allowed = await evidence.execute(staff(["Moderator"]), minor.value.reportId);
    expect(allowed.ok && allowed.value.snapshot).toMatch(/^data:image\/jpeg;base64,/);
    expect(fakes.audit.entries).toMatchObject([
      {
        action: "evidence.viewed",
        actor: { subjectId: "staff-1" },
        target: { type: "report", id: minor.value.reportId },
      },
    ]);

    const missing = await evidence.execute(staff(["Admin"]), "0199f000-0000-7000-8000-0000000000ff");
    expect(!missing.ok && missing.error.code).toBe("report.not_found");
  });
});
