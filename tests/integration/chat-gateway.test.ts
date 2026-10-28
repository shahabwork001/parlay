import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { RecordPartnerBlock } from "../../src/application/features/chat/blocks.js";
import { RecordContentFlag } from "../../src/application/features/moderation/content-flags.js";
import { SubmitReport } from "../../src/application/features/moderation/reports.js";
import { RedisRateLimiter } from "../../src/infrastructure/caching/redis-rate-limiter.js";
import { HmacKeyedHasher } from "../../src/infrastructure/identity/crypto.js";
import {
  createModerationContext,
  type ModerationContext,
} from "../../src/infrastructure/moderation/moderation-composition.js";
import type { Principal } from "../../src/application/features/identity/ports.js";
import type { ClientToServerEvents, ServerToClientEvents } from "../../src/api/realtime/chat-events.js";
import { ChatGateway } from "../../src/api/realtime/chat-gateway.js";
import { createSocketServer, type SocketServerHandle } from "../../src/api/realtime/socket-server.js";
import { JwtAccessTokenService } from "../../src/infrastructure/identity/jwt-access-tokens.js";
import { createInfrastructure, type Infrastructure } from "../../src/infrastructure/infrastructure.js";
import { RedisMatchmaker } from "../../src/infrastructure/matchmaking/redis-matchmaker.js";
import { MongoBlockRepository } from "../../src/infrastructure/persistence/mongo/block-repository.js";
import { silentLogger, testInfrastructureConfig, waitFor } from "./support.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const TERMS = "2026-10-25";
const tokens = new JwtAccessTokenService({
  secret: "integration-test-secret-0123456789",
  issuer: "parley",
  audience: "parley-clients",
  ttlSeconds: 900,
});

const principal = (overrides: Partial<Principal> = {}): Principal => {
  const id = randomUUID();
  return {
    kind: "anonymous",
    subjectId: id,
    deviceId: id,
    roles: [],
    emailVerified: false,
    mfa: false,
    termsVersion: TERMS,
    ...overrides,
  };
};

const once = <E extends keyof ServerToClientEvents>(client: Client, event: E) =>
  new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
    client.once(event, ((payload: Parameters<ServerToClientEvents[E]>[0]) => {
      resolve(payload);
    }) as never);
  });

describe("ChatGateway over Socket.IO", () => {
  let infrastructure: Infrastructure;
  let httpServer: HttpServer;
  let sockets: SocketServerHandle;
  let gateway: ChatGateway;
  let moderation: ModerationContext;
  let matchmaker: RedisMatchmaker;
  let url: string;
  const clients: Client[] = [];

  beforeAll(async () => {
    const config = testInfrastructureConfig();
    infrastructure = await createInfrastructure(config, silentLogger, "gateway-tests");
    moderation = createModerationContext(infrastructure, config);
    await waitFor(() => infrastructure.rabbitMq.isConnected);
    httpServer = createServer();
    sockets = createSocketServer(httpServer, {
      corsAllowedOrigins: ["http://localhost:3000"],
      redisUrl: testInfrastructureConfig().redis.url,
      accessTokens: tokens,
      termsVersion: TERMS,
      bans: moderation.bans,
      hasher: new HmacKeyedHasher("integration-test-hash-secret-0123456789"),
      trustProxy: "loopback",
      logger: silentLogger,
    });
    matchmaker = new RedisMatchmaker(
      infrastructure.redis,
      {
        interestFallbackMs: 300,
        recentPartnerWindowMs: 0,
        scanLimit: 200,
        sessionTtlSeconds: 600,
        reportWindowSeconds: 600,
      },
      `mm-gateway-${randomUUID()}`,
    );
    gateway = new ChatGateway(sockets.io, {
      matchmaker,
      events: infrastructure.eventPublisher,
      // Every test client shares 127.0.0.1, so the network limits must be generous here.
      rateLimiter: new RedisRateLimiter(infrastructure.redis),
      rateLimits: { matchesPerMinute: 1000, messagesPerSecond: 50, networkFactor: 10 },
      bans: moderation.bans,
      trust: moderation.trust,
      textRules: moderation.textRules,
      recentMessages: moderation.recentMessages,
      recordContentFlag: new RecordContentFlag(
        moderation.counter,
        moderation.bans,
        infrastructure.eventPublisher,
        moderation.policy,
        () => new Date(),
      ),
      policy: moderation.policy,
      matchStats: { recordMatch: () => Promise.resolve() },
      logger: silentLogger,
      retryIntervalMs: 100,
      presenceIntervalMs: 1000,
    });
    gateway.start();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.disconnect();
  });

  afterAll(async () => {
    gateway.stop();
    await sockets.close();
    httpServer.close();
    await infrastructure.close();
  });

  async function client(who: Principal = principal()): Promise<Client> {
    const token = (await tokens.issue(who)).token;
    const socket: Client = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return socket;
  }

  async function pair(
    alice: Principal = principal(),
    bob: Principal = principal(),
  ): Promise<[Client, Client, Awaited<ReturnType<typeof once<"match:found">>>]> {
    const a = await client(alice);
    const b = await client(bob);
    const foundA = once(a, "match:found");
    const foundB = once(b, "match:found");
    await a.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    await b.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    const [match] = await Promise.all([foundA, foundB]);
    return [a, b, match];
  }

  it("rejects connections without a valid token or with outdated terms", async () => {
    const anonymous = connect(url, { transports: ["websocket"], reconnection: false });
    clients.push(anonymous);
    await expect(new Promise((_resolve, reject) => anonymous.once("connect_error", reject))).rejects.toThrow(
      "auth.required",
    );

    await expect(client(principal({ termsVersion: "2000-01-01" }))).rejects.toThrow("terms.outdated");
  });

  it("pairs two people and tells each their role", async () => {
    const a = await client();
    const b = await client();
    const foundA = once(a, "match:found");
    const foundB = once(b, "match:found");

    expect(await a.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] })).toEqual({
      ok: true,
      data: { status: "queued" },
    });
    expect(await b.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] })).toEqual({
      ok: true,
      data: { status: "matched" },
    });

    const [matchA, matchB] = await Promise.all([foundA, foundB]);
    expect(matchA.sessionId).toBe(matchB.sessionId);
    expect([matchA.role, matchB.role]).toEqual(["caller", "callee"]);
    expect(matchA.safety.nsfwThreshold).toBe(moderation.policy.nsfwThreshold.standard);
  });

  it("relays filtered messages with delivery acks, and typing", async () => {
    const [a, b] = await pair();
    const received = once(b, "chat:message");
    const typing = once(b, "chat:typing");

    a.emit("chat:typing", { typing: true });
    const ack = await a.emitWithAck("chat:message", { text: "hi, see www.example.com you shit" });

    expect(await typing).toEqual({ typing: true });
    const message = await received;
    expect(ack).toEqual({ ok: true, data: message });
    expect(message.text).toBe("hi, see [link removed] you ••••");
  });

  it("rejects messages with slurs, removes contact details and stops repeated messages", async () => {
    const [a, b] = await pair();
    const received = once(b, "chat:message");

    expect(await a.emitWithAck("chat:message", { text: "you are a f4ggot" })).toMatchObject({
      ok: false,
      error: { code: "chat.message_blocked" },
    });
    await a.emitWithAck("chat:message", { text: "add me on snap: cool_guy99 or call 555 123 4567" });
    expect((await received).text).toBe("add me on [contact removed] or call [contact removed]");

    const results = [];
    for (let attempt = 0; attempt < 4; attempt += 1)
      results.push(await a.emitWithAck("chat:message", { text: "buy followers now" }));
    expect(results.map((result) => result.ok)).toEqual([true, true, true, false]);
    expect(results[3]).toMatchObject({ error: { code: "chat.spam" } });
  });

  it("refuses banned people at connect and disconnects them when a ban lands", async () => {
    const banned = principal();
    await moderation.bans.issue({
      targets: [{ kind: "device", value: banned.deviceId }],
      mode: "full",
      reason: "harassment",
      source: "moderator",
      durationMs: 60_000,
    });
    await expect(client(banned)).rejects.toThrow("moderation.banned");

    const later = principal();
    const socket = await client(later);
    const notice = once(socket, "moderation:banned");
    const disconnected = new Promise((resolve) => socket.once("disconnect", resolve));
    await moderation.bans.issue({
      targets: [{ kind: "device", value: later.deviceId }],
      mode: "full",
      reason: "spam",
      source: "moderator",
      durationMs: 60_000,
    });

    await notice;
    await disconnected;
  });

  it("matches shadow-banned people only with each other", async () => {
    const shadowed = [principal(), principal()];
    for (const who of shadowed)
      await moderation.bans.issue({
        targets: [{ kind: "device", value: who.deviceId }],
        mode: "shadow",
        reason: "spam",
        source: "moderator",
      });
    const regular = await client();
    const [first, second] = await Promise.all(shadowed.map((who) => client(who)));
    const found = once(first!, "match:found");

    await first!.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    expect(await regular.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] })).toEqual(
      {
        ok: true,
        data: { status: "queued" },
      },
    );
    expect(await second!.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] })).toEqual(
      {
        ok: true,
        data: { status: "matched" },
      },
    );
    expect((await found).safety.nsfwThreshold).toBe(moderation.policy.nsfwThreshold.strict);
    await regular.emitWithAck("queue:leave");
  });

  it("reports end the chat, keep the last messages as evidence and suspend for minor safety", async () => {
    const reporter = principal();
    const reported = principal();
    const [a, b, match] = await pair(reporter, reported);
    await b.emitWithAck("chat:message", { text: "how old are you" });
    await a.emitWithAck("chat:message", { text: "please stop" });
    const ended = once(b, "match:ended");
    const banned = once(b, "moderation:banned");

    const submitReport = new SubmitReport({
      matchmaker,
      sessions: gateway,
      recentMessages: moderation.recentMessages,
      reports: moderation.reports,
      evidence: moderation.evidence,
      bans: moderation.bans,
      rateLimiter: new RedisRateLimiter(infrastructure.redis),
      events: infrastructure.eventPublisher,
      policy: moderation.policy,
      clock: () => new Date(),
    });
    const result = await submitReport.execute({
      reporter: { ...reporter, networkHash: "n", subnetHash: "s" },
      sessionId: match.sessionId,
      category: "appears-minor",
      note: null,
      snapshot: null,
    });

    expect(result.ok).toBe(true);
    expect((await ended).reason).toBe("left");
    await banned;
    const report = result.ok ? await moderation.reports.getById(result.value.reportId) : null;
    expect(report).toMatchObject({ tier: "critical", escalation: "required" });
    const evidence = await moderation.evidence.get(report!.evidenceId!);
    expect(evidence?.messages.map((message) => [message.from, message.text])).toEqual([
      ["reported", "how old are you"],
      ["reporter", "please stop"],
    ]);
    expect(evidence!.expiresAt.getTime() - Date.now()).toBeGreaterThan(364 * 24 * 60 * 60_000);
    expect(
      (await moderation.bans.checkAccess({ ...reported, networkHash: "x", subnetHash: "y" })).status,
    ).toBe("banned");
  });

  it("bans automatically after repeated on-device content flags", async () => {
    const socket = await client();
    const banned = once(socket, "moderation:banned");
    const disconnected = new Promise((resolve) => socket.once("disconnect", resolve));
    const outcomes = [];
    for (let flag = 0; flag < 2; flag += 1)
      outcomes.push(await socket.emitWithAck("moderation:flag", { source: "nsfw-screening", score: 0.97 }));
    expect(outcomes.map((outcome) => outcome.ok && outcome.data.outcome)).toEqual(["recorded", "recorded"]);

    // The ban disconnects the socket, usually before the third ack arrives; the notice is what counts.
    socket.emit("moderation:flag", { source: "nsfw-screening", score: 0.97 }, () => undefined);
    await banned;
    await disconnected;
  });

  it("rejects invalid payloads and messages without a partner", async () => {
    const a = await client();

    expect(await a.emitWithAck("queue:join", { mode: "radio" })).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(await a.emitWithAck("chat:message", { text: "anyone?" })).toMatchObject({
      ok: false,
      error: { code: "chat.no_partner" },
    });
  });

  it("notifies the partner on Next, then searches again", async () => {
    const [a, b] = await pair();
    const ended = once(b, "match:ended");

    expect(await a.emitWithAck("match:next")).toEqual({ ok: true, data: { status: "queued" } });

    expect((await ended).reason).toBe("skipped");
  });

  it("notifies the partner immediately when someone disconnects", async () => {
    const [a, b] = await pair();
    const ended = once(b, "match:ended");

    a.disconnect();

    expect((await ended).reason).toBe("disconnected");
  });

  it("matches waiting people with different interests after the fallback", async () => {
    const a = await client();
    const b = await client();
    const found = once(a, "match:found");

    await a.emitWithAck("queue:join", { mode: "text", language: "any", interests: ["chess"] });
    expect(
      await b.emitWithAck("queue:join", { mode: "text", language: "any", interests: ["cooking"] }),
    ).toEqual({
      ok: true,
      data: { status: "queued" },
    });

    expect((await found).sharedInterests).toEqual([]);
  });

  it("never matches people again after a block", async () => {
    const alice = principal();
    const bob = principal();
    const a = await client(alice);
    const b = await client(bob);
    const matched = Promise.all([once(a, "match:found"), once(b, "match:found")]);
    await a.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    await b.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    await matched;

    expect(await a.emitWithAck("match:block")).toEqual({ ok: true, data: null });

    await a.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    expect(await b.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] })).toEqual({
      ok: true,
      data: { status: "queued" },
    });
  });

  async function videoPair(): Promise<[Client, Client]> {
    const a = await client();
    const b = await client();
    const found = Promise.all([once(a, "match:found"), once(b, "match:found")]);
    await a.emitWithAck("queue:join", { mode: "video", language: "any", interests: [] });
    await b.emitWithAck("queue:join", { mode: "video", language: "any", interests: [] });
    await found;
    return [a, b];
  }

  it("relays WebRTC signaling and media state between video partners", async () => {
    const [a, b] = await videoPair();
    const offer = once(b, "rtc:signal");
    const candidate = once(a, "rtc:signal");
    const media = once(b, "media:state");

    a.emit("rtc:signal", { description: { type: "offer", sdp: "v=0 fake offer" } });
    b.emit("rtc:signal", {
      candidate: { candidate: "candidate:1 1 udp 1 127.0.0.1 5000 typ host", sdpMid: "0" },
    });
    a.emit("media:state", { audio: false, video: true });

    expect(await offer).toEqual({ description: { type: "offer", sdp: "v=0 fake offer" } });
    expect(await candidate).toMatchObject({ candidate: { sdpMid: "0" } });
    expect(await media).toEqual({ audio: false, video: true });
  });

  it("drops signaling outside video sessions and malformed signals", async () => {
    const [a, b] = await pair();
    let received = 0;
    b.on("rtc:signal", () => {
      received += 1;
    });

    a.emit("rtc:signal", { description: { type: "offer", sdp: "v=0" } });
    a.emit("rtc:signal", { description: { type: "pranswer-ish", sdp: "x" } });
    await a.emitWithAck("chat:message", { text: "sync point" });

    expect(received).toBe(0);
  });

  it("persists blocks idempotently from the PartnerBlocked event", async () => {
    const handler = new RecordPartnerBlock(new MongoBlockRepository(infrastructure.database));
    const event = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {
        blockerSubjectId: "blocker",
        blockerDeviceId: "blocker-device",
        blockedSubjectId: "blocked",
        blockedDeviceId: "blocked-device",
        blockedAt: new Date().toISOString(),
      },
    };

    await handler.handle(event);
    await handler.handle(event);

    expect(
      await infrastructure.database.collection("blocks").countDocuments({ blockerSubjectId: "blocker" }),
    ).toBe(1);
  });
});
