import type { Redis } from "ioredis";
import { v7 as uuidv7 } from "uuid";
import {
  CHAT_MODES,
  type ChatMode,
  type ChatSession,
  type JoinResult,
  MATCH_POOLS,
  type MatchmakingPolicy,
  type MatchTicket,
  type Participant,
} from "../../application/features/chat/chat-types.js";
import type { Matchmaker } from "../../application/features/chat/matchmaker.js";
import { END_SCRIPT, PAIR_SCRIPT } from "./matchmaking-scripts.js";

const PRESENCE_TTL_MS = 30_000;
const RECENT_TTL_SECONDS = 3600;

const SESSION_FIELDS = [
  "caller",
  "callerDevice",
  "callerMeta",
  "callee",
  "calleeDevice",
  "calleeMeta",
  "mode",
  "shared",
  "startedAt",
] as const;

type Field = string | null | undefined;

const isChatMode = (value: Field): value is ChatMode =>
  typeof value === "string" && (CHAT_MODES as readonly string[]).includes(value);

const splitCsv = (csv: Field) => (csv ? csv.split(",").filter(Boolean) : []);

const packMeta = (participant: Participant) =>
  [participant.kind, participant.networkHash, participant.subnetHash].join("|");

function toParticipant(subjectId: Field, deviceId: Field, meta: Field): Participant | null {
  if (!subjectId || !deviceId) return null;
  const [kind, networkHash = "", subnetHash = ""] = (meta ?? "").split("|");
  return {
    subjectId,
    deviceId,
    kind: kind === "user" ? "user" : "anonymous",
    networkHash,
    subnetHash,
  };
}

/** Redis-backed matchmaking: every state transition is one atomic Lua script or a single command. */
export class RedisMatchmaker implements Matchmaker {
  constructor(
    private readonly redis: Redis,
    private readonly policy: MatchmakingPolicy,
    private readonly prefix = "mm",
    private readonly now: () => number = Date.now,
  ) {}

  async join(ticket: MatchTicket, options: { readonly fresh: boolean }): Promise<JoinResult> {
    if (options.fresh) await this.leaveQueue(ticket.subjectId);

    const now = this.now();
    const reply = (await PAIR_SCRIPT.run(
      this.redis,
      [],
      [
        this.prefix,
        ticket.subjectId,
        ticket.deviceId,
        packMeta(ticket),
        ticket.mode,
        ticket.pool,
        ticket.language,
        ticket.interests.join(","),
        now,
        this.policy.interestFallbackMs,
        this.policy.scanLimit,
        this.policy.recentPartnerWindowMs,
        uuidv7(),
        this.policy.sessionTtlSeconds,
      ],
    )) as Field[];

    const [status, sessionId, partner, partnerDevice, partnerMeta, sharedCsv] = reply;
    if (status === "active" && sessionId) return { status: "in_session", sessionId };
    const caller = toParticipant(partner, partnerDevice, partnerMeta);
    if (status === "matched" && sessionId && caller) {
      return {
        status: "matched",
        session: {
          sessionId,
          mode: ticket.mode,
          caller,
          callee: {
            subjectId: ticket.subjectId,
            deviceId: ticket.deviceId,
            kind: ticket.kind,
            networkHash: ticket.networkHash,
            subnetHash: ticket.subnetHash,
          },
          sharedInterests: splitCsv(sharedCsv),
          startedAt: new Date(now),
        },
      };
    }
    return { status: "queued" };
  }

  async leaveQueue(subjectId: string): Promise<void> {
    const pipeline = this.redis.multi();
    for (const queue of this.queues()) pipeline.zrem(queue, subjectId);
    pipeline.del(this.key("ticket", subjectId));
    await pipeline.exec();
  }

  async activeSession(subjectId: string): Promise<ChatSession | null> {
    const sessionId = await this.redis.get(this.key("active", subjectId));
    if (!sessionId) return null;
    return this.readSession("session", sessionId);
  }

  async findSession(sessionId: string): Promise<ChatSession | null> {
    return (await this.readSession("session", sessionId)) ?? (await this.readSession("ended", sessionId));
  }

  async endSession(subjectId: string): Promise<ChatSession | null> {
    const reply = (await END_SCRIPT.run(
      this.redis,
      [],
      [this.prefix, subjectId, this.now(), RECENT_TTL_SECONDS, this.policy.reportWindowSeconds],
    )) as Field[] | null;
    if (!reply) return null;
    const [sessionId, ...fields] = reply;
    return sessionId ? this.toSession(sessionId, fields) : null;
  }

  async block(blocker: Participant, blocked: Participant): Promise<void> {
    await this.redis.sadd(this.key("blocks", blocker.subjectId), blocked.subjectId, blocked.deviceId);
  }

  async touchPresence(subjectIds: readonly string[]): Promise<void> {
    if (subjectIds.length === 0) return;
    const pipeline = this.redis.pipeline();
    for (const subjectId of subjectIds)
      pipeline.set(this.key("presence", subjectId), "1", "PX", PRESENCE_TTL_MS);
    await pipeline.exec();
  }

  async sweepAbandoned(): Promise<ChatSession[]> {
    const ended: ChatSession[] = [];
    for (const sessionId of await this.redis.smembers(this.key("sessions"))) {
      const [caller, callee] = await this.redis.hmget(this.key("session", sessionId), "caller", "callee");
      if (!caller || !callee) {
        await this.redis.srem(this.key("sessions"), sessionId);
        continue;
      }
      const [callerOnline, calleeOnline] = await Promise.all([this.isOnline(caller), this.isOnline(callee)]);
      if (callerOnline && calleeOnline) continue;
      const session = await this.endSession(callerOnline ? callee : caller);
      if (session) ended.push(session);
    }

    for (const queue of this.queues()) {
      for (const subjectId of await this.redis.zrange(queue, "0", "-1")) {
        if (!(await this.isOnline(subjectId))) await this.leaveQueue(subjectId);
      }
    }
    return ended;
  }

  private async readSession(kind: "session" | "ended", sessionId: string): Promise<ChatSession | null> {
    const fields = await this.redis.hmget(this.key(kind, sessionId), ...SESSION_FIELDS);
    return this.toSession(sessionId, fields);
  }

  private async isOnline(subjectId: string): Promise<boolean> {
    return (await this.redis.exists(this.key("presence", subjectId))) === 1;
  }

  private toSession(sessionId: string, fields: readonly Field[]): ChatSession | null {
    const [caller, callerDevice, callerMeta, callee, calleeDevice, calleeMeta, mode, sharedCsv, startedAt] =
      fields;
    const callerParticipant = toParticipant(caller, callerDevice, callerMeta);
    const calleeParticipant = toParticipant(callee, calleeDevice, calleeMeta);
    if (!callerParticipant || !calleeParticipant || !isChatMode(mode)) return null;
    return {
      sessionId,
      mode,
      caller: callerParticipant,
      callee: calleeParticipant,
      sharedInterests: splitCsv(sharedCsv),
      startedAt: new Date(Number(startedAt) || this.now()),
    };
  }

  private queues(): string[] {
    return CHAT_MODES.flatMap((mode) => MATCH_POOLS.map((pool) => this.key("queue", mode, pool)));
  }

  private key(...parts: string[]): string {
    return [this.prefix, ...parts].join(":");
  }
}
