import type { Redis } from "ioredis";
import { v7 as uuidv7 } from "uuid";
import {
  CHAT_MODES,
  type ChatMode,
  type ChatSession,
  type JoinResult,
  type MatchmakingPolicy,
  type MatchTicket,
  type Participant,
} from "../../application/features/chat/chat-types.js";
import type { Matchmaker } from "../../application/features/chat/matchmaker.js";
import { END_SCRIPT, PAIR_SCRIPT } from "./matchmaking-scripts.js";

const PRESENCE_TTL_MS = 30_000;
const RECENT_TTL_SECONDS = 3600;

const isChatMode = (value: string | undefined): value is ChatMode =>
  value !== undefined && (CHAT_MODES as readonly string[]).includes(value);

const splitCsv = (csv: string | undefined) => (csv ? csv.split(",").filter(Boolean) : []);

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

    const reply = (await PAIR_SCRIPT.run(
      this.redis,
      [],
      [
        this.prefix,
        ticket.subjectId,
        ticket.deviceId,
        ticket.mode,
        ticket.language,
        ticket.interests.join(","),
        this.now(),
        this.policy.interestFallbackMs,
        this.policy.scanLimit,
        this.policy.recentPartnerWindowMs,
        uuidv7(),
        this.policy.sessionTtlSeconds,
      ],
    )) as string[];

    const [status, sessionId, partner, partnerDevice, sharedCsv] = reply;
    if (status === "active" && sessionId) return { status: "in_session", sessionId };
    if (status === "matched" && sessionId && partner && partnerDevice !== undefined) {
      return {
        status: "matched",
        session: {
          sessionId,
          mode: ticket.mode,
          caller: { subjectId: partner, deviceId: partnerDevice },
          callee: { subjectId: ticket.subjectId, deviceId: ticket.deviceId },
          sharedInterests: splitCsv(sharedCsv),
        },
      };
    }
    return { status: "queued" };
  }

  async leaveQueue(subjectId: string): Promise<void> {
    const pipeline = this.redis.multi();
    for (const mode of CHAT_MODES) pipeline.zrem(this.key("queue", mode), subjectId);
    pipeline.del(this.key("ticket", subjectId));
    await pipeline.exec();
  }

  async activeSession(subjectId: string): Promise<ChatSession | null> {
    const sessionId = await this.redis.get(this.key("active", subjectId));
    if (!sessionId) return null;
    const fields = await this.redis.hmget(
      this.key("session", sessionId),
      "caller",
      "callerDevice",
      "callee",
      "calleeDevice",
      "mode",
      "shared",
    );
    return this.toSession([sessionId, ...fields]);
  }

  async endSession(subjectId: string): Promise<ChatSession | null> {
    const reply = (await END_SCRIPT.run(
      this.redis,
      [],
      [this.prefix, subjectId, this.now(), RECENT_TTL_SECONDS],
    )) as (string | null)[] | null;
    return reply ? this.toSession(reply) : null;
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

    for (const mode of CHAT_MODES) {
      for (const subjectId of await this.redis.zrange(this.key("queue", mode), "0", "-1")) {
        if (!(await this.isOnline(subjectId))) await this.leaveQueue(subjectId);
      }
    }
    return ended;
  }

  private async isOnline(subjectId: string): Promise<boolean> {
    return (await this.redis.exists(this.key("presence", subjectId))) === 1;
  }

  private toSession(fields: readonly (string | null | undefined)[]): ChatSession | null {
    const [sessionId, caller, callerDevice, callee, calleeDevice, rawMode, sharedCsv] = fields;
    const mode = rawMode ?? undefined;
    if (!sessionId || !caller || !callerDevice || !callee || !calleeDevice || !isChatMode(mode)) return null;
    return {
      sessionId,
      mode,
      caller: { subjectId: caller, deviceId: callerDevice },
      callee: { subjectId: callee, deviceId: calleeDevice },
      sharedInterests: splitCsv(sharedCsv ?? undefined),
    };
  }

  private key(...parts: string[]): string {
    return [this.prefix, ...parts].join(":");
  }
}
