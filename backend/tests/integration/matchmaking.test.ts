import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { inject } from "vitest";
import type { MatchTicket, Participant } from "../../src/application/features/chat/chat-types.js";
import { RedisMatchmaker } from "../../src/infrastructure/matchmaking/redis-matchmaker.js";

const policy = {
  interestFallbackMs: 5000,
  recentPartnerWindowMs: 60_000,
  scanLimit: 200,
  sessionTtlSeconds: 3600,
  reportWindowSeconds: 600,
};

const participant = (subjectId: string, deviceId = `device-${subjectId}`): Participant => ({
  subjectId,
  deviceId,
  kind: "anonymous",
  networkHash: `net-${subjectId}`,
  subnetHash: "subnet-shared",
});

const ticket = (subjectId: string, overrides: Partial<MatchTicket> = {}): MatchTicket => ({
  ...participant(subjectId, overrides.deviceId),
  mode: "text",
  pool: "standard",
  language: "any",
  interests: [],
  ...overrides,
});

describe("RedisMatchmaker", () => {
  let redis: Redis;
  let now: number;
  let matchmaker: RedisMatchmaker;
  let prefix: string;

  beforeAll(() => {
    redis = new Redis(inject("redisUrl"));
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(() => {
    now = 1_000_000;
    prefix = `mm-test-${randomUUID()}`;
    matchmaker = new RedisMatchmaker(redis, policy, prefix, () => now);
  });

  it("queues the first participant and pairs the second, waiter as caller", async () => {
    expect(await matchmaker.join(ticket("a"), { fresh: true })).toEqual({ status: "queued" });

    const result = await matchmaker.join(ticket("b"), { fresh: true });

    expect(result.status).toBe("matched");
    if (result.status !== "matched") return;
    expect(result.session.caller).toEqual(participant("a"));
    expect(result.session.callee).toEqual(participant("b"));
    expect(result.session.startedAt).toEqual(new Date(now));
    expect((await matchmaker.activeSession("a"))?.sessionId).toBe(result.session.sessionId);
    expect((await matchmaker.activeSession("b"))?.sessionId).toBe(result.session.sessionId);
  });

  it("isolates General and Adult, preserves Adult in ended sessions, and cancels Adult tickets", async () => {
    await matchmaker.join(ticket("general"), { fresh: true });
    expect((await matchmaker.join(ticket("adult-a", { interaction: "adult" }), { fresh: true })).status).toBe(
      "queued",
    );
    const pair = await matchmaker.join(ticket("adult-b", { interaction: "adult" }), { fresh: true });
    expect(pair.status).toBe("matched");
    if (pair.status !== "matched") throw new Error("expected Adult match");
    expect(pair.session.caller.subjectId).toBe("adult-a");
    expect((await matchmaker.activeSession("adult-a"))?.interaction).toBe("adult");
    expect((await matchmaker.endSession("adult-a"))?.interaction).toBe("adult");
    expect((await matchmaker.findSession(pair.session.sessionId))?.interaction).toBe("adult");
    await matchmaker.join(ticket("cancel", { interaction: "adult" }), { fresh: true });
    await matchmaker.leaveQueue("cancel");
    expect(await redis.zscore(`${prefix}:queue:text:adult-standard`, "cancel")).toBeNull();
    expect((await matchmaker.join(ticket("general-b"), { fresh: true })).status).toBe("matched");
  });

  it("does not resurrect an Adult consent ticket after cancellation or a completed match", async () => {
    const adult = ticket("adult", { interaction: "adult" });
    await matchmaker.join(adult, { fresh: true });
    await matchmaker.leaveQueue(adult.subjectId);
    expect((await matchmaker.join(adult, { fresh: false })).status).toBe("cancelled");
    await matchmaker.join(adult, { fresh: true });
    await matchmaker.join(ticket("partner", { interaction: "adult" }), { fresh: true });
    await matchmaker.endSession(adult.subjectId);
    expect((await matchmaker.join(adult, { fresh: false })).status).toBe("cancelled");
  });

  it("fences stale owners and an old report cannot end a replacement session", async () => {
    await matchmaker.claimConnection("a", "old-socket");
    await matchmaker.join(ticket("a", { ownerId: "old-socket" }), { fresh: true });
    expect(await matchmaker.claimConnection("a", "new-socket")).toBe("old-socket");
    await matchmaker.join(ticket("a", { ownerId: "new-socket" }), { fresh: true });
    await matchmaker.leaveQueue("a", "old-socket");
    expect((await matchmaker.join(ticket("a", { ownerId: "old-socket" }), { fresh: false })).status).toBe(
      "cancelled",
    );
    const result = await matchmaker.join(ticket("b"), { fresh: true });
    if (result.status !== "matched") throw new Error("expected a new-owner match");
    expect(await matchmaker.endSession("a", "old-socket")).toBeNull();
    expect(await matchmaker.endSession("a", undefined, "an-old-session")).toBeNull();
    expect((await matchmaker.activeSession("a"))?.sessionId).toBe(result.session.sessionId);
    expect((await matchmaker.endSession("a", "new-socket"))?.sessionId).toBe(result.session.sessionId);
  });

  it("does not select a replaced socket's ticket during the takeover gap", async () => {
    await matchmaker.claimConnection("a", "old");
    await matchmaker.join(ticket("a", { ownerId: "old" }), { fresh: true });
    await matchmaker.claimConnection("a", "new");
    expect((await matchmaker.join(ticket("b"), { fresh: true })).status).toBe("queued");
    expect((await matchmaker.join(ticket("a", { ownerId: "new" }), { fresh: true })).status).toBe("matched");
  });

  it("keeps text and video queues separate", async () => {
    await matchmaker.join(ticket("a", { mode: "video" }), { fresh: true });
    expect((await matchmaker.join(ticket("b", { mode: "text" }), { fresh: true })).status).toBe("queued");
  });

  it("keeps matchmaking pools separate (low trust and shadow bans)", async () => {
    await matchmaker.join(ticket("shadowed", { pool: "shadow" }), { fresh: true });
    await matchmaker.join(ticket("distrusted", { pool: "low-trust" }), { fresh: true });
    expect((await matchmaker.join(ticket("regular"), { fresh: true })).status).toBe("queued");

    const shadowPair = await matchmaker.join(ticket("also-shadowed", { pool: "shadow" }), { fresh: true });
    expect(shadowPair.status === "matched" && shadowPair.session.caller.subjectId).toBe("shadowed");
  });

  it("keeps an ended session findable for the report window", async () => {
    await matchmaker.join(ticket("a"), { fresh: true });
    const result = await matchmaker.join(ticket("b"), { fresh: true });
    if (result.status !== "matched") throw new Error("expected a match");

    await matchmaker.endSession("a");

    expect(await matchmaker.activeSession("a")).toBeNull();
    const ended = await matchmaker.findSession(result.session.sessionId);
    expect(ended?.caller).toEqual(participant("a"));
    expect(ended?.callee.networkHash).toBe("net-b");
    expect(await redis.ttl(`${prefix}:ended:${result.session.sessionId}`)).toBeGreaterThan(590);
  });

  it("reports an existing session instead of matching again", async () => {
    await matchmaker.join(ticket("a"), { fresh: true });
    await matchmaker.join(ticket("b"), { fresh: true });

    expect((await matchmaker.join(ticket("a"), { fresh: false })).status).toBe("in_session");
  });

  it("prefers the candidate with the most shared interests", async () => {
    await matchmaker.join(ticket("random"), { fresh: true });
    await matchmaker.join(ticket("one", { interests: ["chess"] }), { fresh: true });
    await matchmaker.join(ticket("two", { interests: ["music", "art"] }), { fresh: true });

    const result = await matchmaker.join(ticket("me", { interests: ["music", "art", "chess"] }), {
      fresh: true,
    });

    expect(result.status === "matched" && result.session.caller.subjectId).toBe("two");
    expect(result.status === "matched" && [...result.session.sharedInterests].sort()).toEqual([
      "art",
      "music",
    ]);
  });

  it("waits for a shared interest, then falls back to random after the timeout", async () => {
    await matchmaker.join(ticket("cooking", { interests: ["cooking"] }), { fresh: true });

    expect((await matchmaker.join(ticket("chess", { interests: ["chess"] }), { fresh: true })).status).toBe(
      "queued",
    );

    now += policy.interestFallbackMs;
    const retry = await matchmaker.join(ticket("chess", { interests: ["chess"] }), { fresh: false });
    expect(retry.status).toBe("matched");
  });

  it("matches participants without interests at random immediately", async () => {
    await matchmaker.join(ticket("a"), { fresh: true });
    expect((await matchmaker.join(ticket("b"), { fresh: true })).status).toBe("matched");
  });

  it("does not match a waiting participant with interests to a random newcomer before their fallback", async () => {
    await matchmaker.join(ticket("picky", { interests: ["jazz"] }), { fresh: true });
    expect((await matchmaker.join(ticket("random"), { fresh: true })).status).toBe("queued");
  });

  it("respects language preferences, with any matching everyone", async () => {
    await matchmaker.join(ticket("de", { language: "de" }), { fresh: true });

    expect((await matchmaker.join(ticket("en", { language: "en" }), { fresh: true })).status).toBe("queued");
    const anyone = await matchmaker.join(ticket("any", { language: "any" }), { fresh: true });
    expect(anyone.status === "matched" && anyone.session.caller.subjectId).toBe("de");
  });

  it("never matches blocked subjects or devices, in either direction", async () => {
    await matchmaker.block(participant("a"), participant("b"));

    await matchmaker.join(ticket("b"), { fresh: true });
    expect((await matchmaker.join(ticket("a"), { fresh: true })).status).toBe("queued");

    await matchmaker.leaveQueue("a");
    await matchmaker.leaveQueue("b");
    await matchmaker.join(ticket("a"), { fresh: true });
    expect(
      (await matchmaker.join(ticket("b-new-account", { deviceId: "device-b" }), { fresh: true })).status,
    ).toBe("queued");
  });

  it("does not immediately re-pair recent partners", async () => {
    await matchmaker.join(ticket("a"), { fresh: true });
    await matchmaker.join(ticket("b"), { fresh: true });
    const ended = await matchmaker.endSession("a");
    expect(ended?.caller.subjectId).toBe("a");

    await matchmaker.join(ticket("a"), { fresh: true });
    expect((await matchmaker.join(ticket("b"), { fresh: true })).status).toBe("queued");

    now += policy.recentPartnerWindowMs;
    expect((await matchmaker.join(ticket("b"), { fresh: false })).status).toBe("matched");
  });

  it("ends a session for both participants exactly once", async () => {
    await matchmaker.join(ticket("a"), { fresh: true });
    await matchmaker.join(ticket("b"), { fresh: true });

    const first = await matchmaker.endSession("b");
    const second = await matchmaker.endSession("a");

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await matchmaker.activeSession("a")).toBeNull();
    expect(await matchmaker.activeSession("b")).toBeNull();
  });

  it("never double-matches under concurrent joins", async () => {
    const subjects = Array.from({ length: 200 }, (_, index) => `user-${index}`);

    const results = await Promise.all(
      subjects.map((subject) => matchmaker.join(ticket(subject), { fresh: true })),
    );

    const sessions = results.flatMap((result) => (result.status === "matched" ? [result.session] : []));
    const participants = sessions.flatMap((session) => [session.caller.subjectId, session.callee.subjectId]);
    expect(new Set(participants).size).toBe(participants.length);
    expect(sessions.length).toBe(100);
    for (const session of sessions) {
      expect((await matchmaker.activeSession(session.caller.subjectId))?.sessionId).toBe(session.sessionId);
    }
  });

  it("sweeps sessions and tickets of participants who went offline", async () => {
    await matchmaker.touchPresence(["a", "b", "c"]);
    await matchmaker.join(ticket("a"), { fresh: true });
    await matchmaker.join(ticket("b"), { fresh: true });
    await matchmaker.join(ticket("c", { mode: "video" }), { fresh: true });
    await matchmaker.touchPresence(["a"]);
    await redis.del(
      `${matchmakerPrefix(matchmaker)}:presence:b`,
      `${matchmakerPrefix(matchmaker)}:presence:c`,
    );

    const ended = await matchmaker.sweepAbandoned();

    expect(ended).toHaveLength(1);
    expect(await matchmaker.activeSession("a")).toBeNull();
    await matchmaker.touchPresence(["d"]);
    expect((await matchmaker.join(ticket("d", { mode: "video" }), { fresh: true })).status).toBe("queued");
  });
});

/** The prefix is private; tests read it back through the key format used everywhere. */
function matchmakerPrefix(matchmaker: RedisMatchmaker): string {
  return (matchmaker as unknown as { prefix: string }).prefix;
}
