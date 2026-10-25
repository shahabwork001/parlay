import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { inject } from "vitest";
import type { MatchTicket } from "../../src/application/features/chat/chat-types.js";
import { RedisMatchmaker } from "../../src/infrastructure/matchmaking/redis-matchmaker.js";

const policy = {
  interestFallbackMs: 5000,
  recentPartnerWindowMs: 60_000,
  scanLimit: 200,
  sessionTtlSeconds: 3600,
};

const ticket = (subjectId: string, overrides: Partial<MatchTicket> = {}): MatchTicket => ({
  subjectId,
  deviceId: `device-${subjectId}`,
  mode: "text",
  language: "any",
  interests: [],
  ...overrides,
});

describe("RedisMatchmaker", () => {
  let redis: Redis;
  let now: number;
  let matchmaker: RedisMatchmaker;

  beforeAll(() => {
    redis = new Redis(inject("redisUrl"));
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(() => {
    now = 1_000_000;
    matchmaker = new RedisMatchmaker(redis, policy, `mm-test-${randomUUID()}`, () => now);
  });

  it("queues the first participant and pairs the second, waiter as caller", async () => {
    expect(await matchmaker.join(ticket("a"), { fresh: true })).toEqual({ status: "queued" });

    const result = await matchmaker.join(ticket("b"), { fresh: true });

    expect(result.status).toBe("matched");
    if (result.status !== "matched") return;
    expect(result.session.caller).toEqual({ subjectId: "a", deviceId: "device-a" });
    expect(result.session.callee).toEqual({ subjectId: "b", deviceId: "device-b" });
    expect((await matchmaker.activeSession("a"))?.sessionId).toBe(result.session.sessionId);
    expect((await matchmaker.activeSession("b"))?.sessionId).toBe(result.session.sessionId);
  });

  it("keeps text and video queues separate", async () => {
    await matchmaker.join(ticket("a", { mode: "video" }), { fresh: true });
    expect((await matchmaker.join(ticket("b", { mode: "text" }), { fresh: true })).status).toBe("queued");
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
    await matchmaker.block(
      { subjectId: "a", deviceId: "device-a" },
      { subjectId: "b", deviceId: "device-b" },
    );

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
