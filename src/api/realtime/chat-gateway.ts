import { v7 as uuidv7 } from "uuid";
import type { EventPublisher } from "../../application/abstractions/messaging/integration-event.js";
import type { RateLimiter } from "../../application/abstractions/rate-limiter.js";
import { PartnerBlocked } from "../../application/features/chat/blocks.js";
import {
  type ChatSession,
  type EndReason,
  type MatchPool,
  type MatchTicket,
  type Participant,
  partnerOf,
} from "../../application/features/chat/chat-types.js";
import type { Matchmaker } from "../../application/features/chat/matchmaker.js";
import type { RecentMessages } from "../../application/features/chat/recent-messages.js";
import {
  BANNED_EVENT,
  deviceRoom,
  networkRoom,
  subjectRoom,
  subnetRoom,
} from "../../application/features/chat/rooms.js";
import {
  chatMessageSchema,
  joinQueueSchema,
  mediaStateSchema,
  rtcSignalSchema,
  typingSchema,
} from "../../application/features/chat/schemas.js";
import type { ChatSessionControl } from "../../application/features/chat/session-control.js";
import type { BanService } from "../../application/features/moderation/bans.js";
import type { RecordContentFlag } from "../../application/features/moderation/content-flags.js";
import { ContentFlagged, SessionEnded } from "../../application/features/moderation/events.js";
import type { ModerationPolicy } from "../../application/features/moderation/moderation-policy.js";
import type { AccessIdentity } from "../../application/features/moderation/network.js";
import type { TextRulesProvider, TrustStore } from "../../application/features/moderation/ports.js";
import { contentFlagSchema } from "../../application/features/moderation/schemas.js";
import { moderateText, RepeatGuard } from "../../application/features/moderation/text-moderation.js";
import { trustKeys, trustTier } from "../../domain/moderation/trust.js";
import type { Logger } from "../../infrastructure/observability/logger.js";
import type { Ack, AckCallback } from "./chat-events.js";
import type { ChatServer, ChatSocket } from "./socket-server.js";
import { TokenBucket } from "./token-bucket.js";

/** Per-person limits (each applies separately to the account, the device and the network address). */
export interface ChatRateLimits {
  /** Searches (join or next) per minute. */
  readonly matchesPerMinute: number;
  /** Messages per second; the network limit is this times `networkFactor` (shared connections). */
  readonly messagesPerSecond: number;
  readonly networkFactor: number;
}

export const DEFAULT_CHAT_RATE_LIMITS: ChatRateLimits = {
  matchesPerMinute: 30,
  messagesPerSecond: 5,
  networkFactor: 4,
};

export interface ChatGatewayOptions {
  readonly matchmaker: Matchmaker;
  readonly events: EventPublisher;
  readonly rateLimiter: RateLimiter;
  readonly rateLimits: ChatRateLimits;
  readonly bans: BanService;
  readonly trust: TrustStore;
  readonly textRules: TextRulesProvider;
  readonly recentMessages: RecentMessages;
  readonly recordContentFlag: RecordContentFlag;
  readonly policy: ModerationPolicy;
  readonly logger: Logger;
  /** How often a waiting participant retries pairing (picks up the interest fallback). */
  readonly retryIntervalMs: number;
  /** How often connected participants refresh their presence. */
  readonly presenceIntervalMs: number;
}

const ok = <T>(data: T): Ack<T> => ({ ok: true, data });
const failure = (code: string, message: string): Ack<never> => ({ ok: false, error: { code, message } });

const INVALID = failure("validation", "The request is invalid.");
const NOT_IN_CHAT = failure("chat.no_partner", "You are not connected to anyone.");
const SLOW_DOWN = failure("rate_limited", "You are sending messages too quickly.");
const SEARCHING_TOO_FAST = failure("rate_limited", "You are skipping very quickly. Wait a moment.");
const MESSAGE_BLOCKED = failure(
  "chat.message_blocked",
  "That message breaks the Community Guidelines and was not sent.",
);
const SPAM = failure("chat.spam", "You already sent that a few times.");
const BANNED = failure("moderation.banned", "Your access to chat is suspended.");
const INTERNAL = failure("internal", "Something went wrong. Try again.");

const respond = <T>(ack: unknown, result: Ack<T>) => {
  if (typeof ack === "function") (ack as AckCallback<T>)(result);
};

interface Connection {
  ticket: MatchTicket | null;
  retryTimer: NodeJS.Timeout | null;
  readonly typing: TokenBucket;
  readonly signals: TokenBucket;
  readonly flags: TokenBucket;
  readonly repeats: RepeatGuard;
}

const toIdentity = (participant: Participant) => ({
  subjectId: participant.subjectId,
  deviceId: participant.deviceId,
  kind: participant.kind,
});

/**
 * Real-time chat: matchmaking, relaying messages and typing, and ending sessions. Holds no shared
 * state beyond Redis; per-connection state (retry timer, flood buckets, spam guard) lives with the socket.
 */
export class ChatGateway implements ChatSessionControl {
  readonly #connections = new Map<string, Connection>();
  readonly #onlineSubjects = new Map<string, number>();
  #presenceTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly io: ChatServer,
    private readonly options: ChatGatewayOptions,
  ) {}

  start(): void {
    this.io.on("connection", (socket) => {
      this.connect(socket);
    });
    this.#presenceTimer = setInterval(() => {
      void this.options.matchmaker.touchPresence([...this.#onlineSubjects.keys()]).catch((error: unknown) => {
        this.options.logger.warn({ err: error }, "Presence refresh failed");
      });
    }, this.options.presenceIntervalMs);
  }

  stop(): void {
    if (this.#presenceTimer) clearInterval(this.#presenceTimer);
    for (const connection of this.#connections.values()) this.stopRetry(connection);
  }

  /**
   * Tells the remaining participant of sessions ended anywhere (here, by the presence sweeper, or by a
   * report) and publishes the end for trust scoring.
   */
  notifyEnded(session: ChatSession, reason: EndReason, endedBySubjectId?: string): void {
    for (const participant of [session.caller, session.callee]) {
      if (participant.subjectId === endedBySubjectId) continue;
      this.io
        .to(subjectRoom(participant.subjectId))
        .emit("match:ended", { sessionId: session.sessionId, reason });
    }
    this.options.events
      .publish(SessionEnded, {
        sessionId: session.sessionId,
        mode: session.mode,
        startedAt: session.startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        participants: [toIdentity(session.caller), toIdentity(session.callee)],
      })
      .catch((error: unknown) => {
        this.options.logger.error({ err: error }, "Publishing SessionEnded failed");
      });
  }

  async endIfActive(subjectId: string, sessionId: string): Promise<void> {
    const active = await this.options.matchmaker.activeSession(subjectId);
    if (active?.sessionId !== sessionId) return;
    const session = await this.options.matchmaker.endSession(subjectId);
    if (session) this.notifyEnded(session, "left", subjectId);
  }

  private connect(socket: ChatSocket): void {
    const { identity } = socket.data;
    const { subjectId } = identity;
    const connection: Connection = {
      ticket: null,
      retryTimer: null,
      typing: new TokenBucket(5, 2),
      signals: new TokenBucket(60, 20),
      flags: new TokenBucket(3, 0.1),
      repeats: new RepeatGuard(),
    };
    this.#connections.set(socket.id, connection);
    this.#onlineSubjects.set(subjectId, (this.#onlineSubjects.get(subjectId) ?? 0) + 1);
    void socket.join([
      subjectRoom(subjectId),
      deviceRoom(identity.deviceId),
      networkRoom(identity.networkHash),
      subnetRoom(identity.subnetHash),
    ]);
    void this.options.matchmaker.touchPresence([subjectId]);

    const guard =
      <A extends unknown[]>(name: string, handler: (...args: A) => Promise<void>) =>
      (...args: A) => {
        handler(...args).catch((error: unknown) => {
          this.options.logger.error({ err: error, event: name }, "Chat event failed");
          respond(args.at(-1), INTERNAL);
        });
      };

    /** Starts a new search, re-checking bans and trust so changes apply from the next search. */
    const startSearch = async (ack: unknown, ticket: Omit<MatchTicket, "pool"> | null) => {
      if (!ticket) {
        respond(ack, INVALID);
        return;
      }
      if (!(await this.withinLimits("match", identity, this.options.rateLimits.matchesPerMinute, 60_000))) {
        respond(ack, SEARCHING_TOO_FAST);
        return;
      }
      const pool = await this.poolFor(identity);
      if (pool === "banned") {
        respond(ack, BANNED);
        socket.emit(BANNED_EVENT, {});
        socket.disconnect(true);
        return;
      }
      connection.ticket = { ...ticket, pool };
      respond(ack, ok({ status: await this.search(connection, true) }));
    };

    socket.on(
      "queue:join",
      guard("queue:join", async (payload: unknown, ack: unknown) => {
        const parsed = joinQueueSchema.safeParse(payload);
        if (!parsed.success) {
          respond(ack, INVALID);
          return;
        }
        await this.endSession(socket, "left");
        await startSearch(ack, { ...this.participant(socket), ...parsed.data });
      }),
    );

    socket.on(
      "match:next",
      guard("match:next", async (ack: unknown) => {
        await this.endSession(socket, "skipped");
        await startSearch(ack, connection.ticket);
      }),
    );

    socket.on(
      "queue:leave",
      guard("queue:leave", async (ack: unknown) => {
        this.stopRetry(connection);
        connection.ticket = null;
        await this.endSession(socket, "left");
        await this.options.matchmaker.leaveQueue(subjectId);
        respond(ack, ok(null));
      }),
    );

    socket.on(
      "match:block",
      guard("match:block", async (ack: unknown) => {
        const session = await this.endSession(socket, "left");
        if (!session) {
          respond(ack, NOT_IN_CHAT);
          return;
        }
        const me = this.participant(socket);
        const partner = partnerOf(session, subjectId);
        await this.options.matchmaker.block(me, partner);
        this.options.events
          .publish(PartnerBlocked, {
            blockerSubjectId: me.subjectId,
            blockerDeviceId: me.deviceId,
            blockedSubjectId: partner.subjectId,
            blockedDeviceId: partner.deviceId,
            blockedAt: new Date().toISOString(),
          })
          .catch((error: unknown) => {
            this.options.logger.error({ err: error }, "Publishing PartnerBlocked failed");
          });
        respond(ack, ok(null));
      }),
    );

    socket.on(
      "chat:message",
      guard("chat:message", async (payload: unknown, ack: unknown) => {
        const parsed = chatMessageSchema.safeParse(payload);
        if (!parsed.success) {
          respond(ack, INVALID);
          return;
        }
        if (
          !(await this.withinLimits("message", identity, this.options.rateLimits.messagesPerSecond, 1000))
        ) {
          respond(ack, SLOW_DOWN);
          return;
        }

        const rules = await this.options.textRules.current();
        const strict = connection.ticket !== null && connection.ticket.pool !== "standard";
        const moderated = moderateText(parsed.data.text, rules, { strict });
        if (moderated.status === "empty") {
          respond(ack, INVALID);
          return;
        }
        if (moderated.status === "blocked") {
          this.publishBlockedMessage(identity);
          respond(ack, MESSAGE_BLOCKED);
          return;
        }
        if (connection.repeats.isSpam(moderated.text, Date.now(), rules)) {
          respond(ack, SPAM);
          return;
        }

        const session = await this.options.matchmaker.activeSession(subjectId);
        if (!session) {
          respond(ack, NOT_IN_CHAT);
          return;
        }

        const sentAt = new Date();
        const message = { id: uuidv7(), text: moderated.text, sentAt: sentAt.toISOString() };
        await this.options.recentMessages.append(session.sessionId, {
          senderSubjectId: subjectId,
          text: moderated.text,
          sentAt,
        });
        this.io.to(subjectRoom(partnerOf(session, subjectId).subjectId)).emit("chat:message", message);
        respond(ack, ok(message));
      }),
    );

    socket.on(
      "chat:typing",
      guard("chat:typing", async (payload: unknown) => {
        const parsed = typingSchema.safeParse(payload);
        if (!parsed.success || !connection.typing.tryTake()) return;
        const session = await this.options.matchmaker.activeSession(subjectId);
        if (session)
          this.io.to(subjectRoom(partnerOf(session, subjectId).subjectId)).emit("chat:typing", parsed.data);
      }),
    );

    socket.on(
      "rtc:signal",
      guard("rtc:signal", async (payload: unknown) => {
        const parsed = rtcSignalSchema.safeParse(payload);
        if (!parsed.success || !connection.signals.tryTake()) return;
        const session = await this.options.matchmaker.activeSession(subjectId);
        if (session?.mode !== "video") return;
        this.io.to(subjectRoom(partnerOf(session, subjectId).subjectId)).emit("rtc:signal", parsed.data);
      }),
    );

    socket.on(
      "media:state",
      guard("media:state", async (payload: unknown) => {
        const parsed = mediaStateSchema.safeParse(payload);
        if (!parsed.success || !connection.typing.tryTake()) return;
        const session = await this.options.matchmaker.activeSession(subjectId);
        if (session)
          this.io.to(subjectRoom(partnerOf(session, subjectId).subjectId)).emit("media:state", parsed.data);
      }),
    );

    socket.on(
      "moderation:flag",
      guard("moderation:flag", async (payload: unknown, ack: unknown) => {
        const parsed = contentFlagSchema.safeParse(payload);
        if (!parsed.success) {
          respond(ack, INVALID);
          return;
        }
        if (!connection.flags.tryTake()) {
          respond(ack, ok({ outcome: "recorded" as const }));
          return;
        }
        const outcome = await this.options.recordContentFlag.execute(identity, parsed.data.score);
        respond(ack, ok({ outcome }));
      }),
    );

    socket.on("disconnect", () => {
      this.stopRetry(connection);
      this.#connections.delete(socket.id);
      const remaining = (this.#onlineSubjects.get(subjectId) ?? 1) - 1;
      if (remaining > 0) {
        this.#onlineSubjects.set(subjectId, remaining);
        return;
      }
      this.#onlineSubjects.delete(subjectId);
      void Promise.all([
        this.endSession(socket, "disconnected"),
        this.options.matchmaker.leaveQueue(subjectId),
      ]).catch((error: unknown) => {
        this.options.logger.error({ err: error }, "Cleaning up after disconnect failed");
      });
    });
  }

  /** Banned people cannot search; shadow-banned and low-trust people search in their own pools. */
  private async poolFor(identity: AccessIdentity): Promise<MatchPool | "banned"> {
    const access = await this.options.bans.checkAccess(identity);
    if (access.status === "banned") return "banned";
    if (access.status === "shadow") return "shadow";
    const trust = await this.options.trust.scoreOf(trustKeys(identity));
    return trustTier(trust) === "low" ? "low-trust" : "standard";
  }

  /**
   * Sliding-window limits per account, device and network address. Fails open when Redis is
   * unavailable: the per-connection buckets and moderation still apply.
   */
  private async withinLimits(
    name: string,
    identity: AccessIdentity,
    limit: number,
    windowMs: number,
  ): Promise<boolean> {
    const { rateLimiter, rateLimits } = this.options;
    try {
      const decisions = await Promise.all([
        rateLimiter.consume(`chat.${name}:subject:${identity.subjectId}`, limit, windowMs),
        rateLimiter.consume(`chat.${name}:device:${identity.deviceId}`, limit, windowMs),
        rateLimiter.consume(
          `chat.${name}:net:${identity.networkHash}`,
          limit * rateLimits.networkFactor,
          windowMs,
        ),
      ]);
      return decisions.every((decision) => decision.allowed);
    } catch (error) {
      this.options.logger.warn({ err: error }, "Chat rate limiter unavailable; allowing");
      return true;
    }
  }

  private publishBlockedMessage(identity: AccessIdentity): void {
    this.options.events
      .publish(ContentFlagged, {
        subjectId: identity.subjectId,
        deviceId: identity.deviceId,
        kind: identity.kind,
        source: "blocked-message",
        score: null,
        flaggedAt: new Date().toISOString(),
      })
      .catch((error: unknown) => {
        this.options.logger.error({ err: error }, "Publishing ContentFlagged failed");
      });
  }

  /** One pairing attempt; keeps retrying in the background while queued. */
  private async search(connection: Connection, fresh: boolean): Promise<"matched" | "queued"> {
    this.stopRetry(connection);
    const ticket = connection.ticket;
    if (!ticket) return "queued";

    const result = await this.options.matchmaker.join(ticket, { fresh });
    if (result.status === "matched") {
      this.announce(result.session, ticket.pool);
      return "matched";
    }
    if (result.status === "queued") {
      connection.retryTimer = setTimeout(() => {
        void this.search(connection, false).catch((error: unknown) => {
          this.options.logger.error({ err: error }, "Matchmaking retry failed");
        });
      }, this.options.retryIntervalMs);
      return "queued";
    }
    return "matched";
  }

  /** Both participants come from the same pool, so the pool sets screening for both. */
  private announce(session: ChatSession, pool: MatchPool): void {
    const { nsfwThreshold } = this.options.policy;
    const base = {
      sessionId: session.sessionId,
      mode: session.mode,
      sharedInterests: session.sharedInterests,
      safety: { nsfwThreshold: pool === "standard" ? nsfwThreshold.standard : nsfwThreshold.strict },
    };
    this.io.to(subjectRoom(session.caller.subjectId)).emit("match:found", { ...base, role: "caller" });
    this.io.to(subjectRoom(session.callee.subjectId)).emit("match:found", { ...base, role: "callee" });
  }

  private async endSession(socket: ChatSocket, reason: EndReason): Promise<ChatSession | null> {
    const subjectId = socket.data.identity.subjectId;
    const session = await this.options.matchmaker.endSession(subjectId);
    if (session) this.notifyEnded(session, reason, subjectId);
    return session;
  }

  private participant(socket: ChatSocket): Participant {
    const { identity } = socket.data;
    return {
      subjectId: identity.subjectId,
      deviceId: identity.deviceId,
      kind: identity.kind,
      networkHash: identity.networkHash,
      subnetHash: identity.subnetHash,
    };
  }

  private stopRetry(connection: Connection): void {
    if (connection.retryTimer) clearTimeout(connection.retryTimer);
    connection.retryTimer = null;
  }
}
