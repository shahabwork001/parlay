import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { RecordPartnerBlock } from "../../src/application/features/chat/blocks.js";
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
  let url: string;
  const clients: Client[] = [];

  beforeAll(async () => {
    infrastructure = await createInfrastructure(testInfrastructureConfig(), silentLogger, "gateway-tests");
    await waitFor(() => infrastructure.rabbitMq.isConnected);
    httpServer = createServer();
    sockets = createSocketServer(httpServer, {
      corsAllowedOrigins: ["http://localhost:3000"],
      redisUrl: testInfrastructureConfig().redis.url,
      accessTokens: tokens,
      termsVersion: TERMS,
      logger: silentLogger,
    });
    const matchmaker = new RedisMatchmaker(
      infrastructure.redis,
      { interestFallbackMs: 300, recentPartnerWindowMs: 0, scanLimit: 200, sessionTtlSeconds: 600 },
      `mm-gateway-${randomUUID()}`,
    );
    gateway = new ChatGateway(sockets.io, {
      matchmaker,
      events: infrastructure.eventPublisher,
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

  async function pair(): Promise<[Client, Client]> {
    const a = await client();
    const b = await client();
    const foundA = once(a, "match:found");
    const foundB = once(b, "match:found");
    await a.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    await b.emitWithAck("queue:join", { mode: "text", language: "any", interests: [] });
    await Promise.all([foundA, foundB]);
    return [a, b];
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
