import { v7 as uuidv7 } from "uuid";
import type { EventPublisher } from "../../application/abstractions/messaging/integration-event.js";
import { PartnerBlocked } from "../../application/features/chat/blocks.js";
import {
  type ChatSession,
  type EndReason,
  type MatchTicket,
  partnerOf,
} from "../../application/features/chat/chat-types.js";
import type { Matchmaker } from "../../application/features/chat/matchmaker.js";
import {
  chatMessageSchema,
  joinQueueSchema,
  mediaStateSchema,
  rtcSignalSchema,
  typingSchema,
} from "../../application/features/chat/schemas.js";
import { filterChatText } from "../../application/features/chat/text-filter.js";
import type { Logger } from "../../infrastructure/observability/logger.js";
import type { Ack, AckCallback } from "./chat-events.js";
import type { ChatServer, ChatSocket } from "./socket-server.js";
import { TokenBucket } from "./token-bucket.js";

export interface ChatGatewayOptions {
  readonly matchmaker: Matchmaker;
  readonly events: EventPublisher;
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
const INTERNAL = failure("internal", "Something went wrong. Try again.");

const room = (subjectId: string) => `subject:${subjectId}`;

const respond = <T>(ack: unknown, result: Ack<T>) => {
  if (typeof ack === "function") (ack as AckCallback<T>)(result);
};

interface Connection {
  ticket: MatchTicket | null;
  retryTimer: NodeJS.Timeout | null;
  readonly messages: TokenBucket;
  readonly typing: TokenBucket;
  readonly signals: TokenBucket;
}

/**
 * Real-time chat: matchmaking, relaying messages and typing, and ending sessions. Holds no shared
 * state beyond Redis; per-connection state (retry timer, flood buckets) lives with the socket.
 */
export class ChatGateway {
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

  /** Tells the remaining participant of sessions ended elsewhere (e.g. by the presence sweeper). */
  notifyEnded(session: ChatSession, reason: EndReason, endedBySubjectId?: string): void {
    for (const participant of [session.caller, session.callee]) {
      if (participant.subjectId === endedBySubjectId) continue;
      this.io.to(room(participant.subjectId)).emit("match:ended", { sessionId: session.sessionId, reason });
    }
  }

  private connect(socket: ChatSocket): void {
    const { subjectId } = socket.data.principal;
    const connection: Connection = {
      ticket: null,
      retryTimer: null,
      messages: new TokenBucket(10, 3),
      typing: new TokenBucket(5, 2),
      signals: new TokenBucket(60, 20),
    };
    this.#connections.set(socket.id, connection);
    this.#onlineSubjects.set(subjectId, (this.#onlineSubjects.get(subjectId) ?? 0) + 1);
    void socket.join(room(subjectId));
    void this.options.matchmaker.touchPresence([subjectId]);

    const guard =
      <A extends unknown[]>(name: string, handler: (...args: A) => Promise<void>) =>
      (...args: A) => {
        handler(...args).catch((error: unknown) => {
          this.options.logger.error({ err: error, event: name }, "Chat event failed");
          respond(args.at(-1), INTERNAL);
        });
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
        connection.ticket = { ...this.participant(socket), ...parsed.data };
        respond(ack, ok({ status: await this.search(connection, true) }));
      }),
    );

    socket.on(
      "match:next",
      guard("match:next", async (ack: unknown) => {
        await this.endSession(socket, "skipped");
        if (!connection.ticket) {
          respond(ack, INVALID);
          return;
        }
        respond(ack, ok({ status: await this.search(connection, true) }));
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
        if (!connection.messages.tryTake()) {
          respond(ack, SLOW_DOWN);
          return;
        }

        const filtered = filterChatText(parsed.data.text);
        if (!filtered.text) {
          respond(ack, INVALID);
          return;
        }
        const session = await this.options.matchmaker.activeSession(subjectId);
        if (!session) {
          respond(ack, NOT_IN_CHAT);
          return;
        }

        const message = { id: uuidv7(), text: filtered.text, sentAt: new Date().toISOString() };
        this.io.to(room(partnerOf(session, subjectId).subjectId)).emit("chat:message", message);
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
          this.io.to(room(partnerOf(session, subjectId).subjectId)).emit("chat:typing", parsed.data);
      }),
    );

    socket.on(
      "rtc:signal",
      guard("rtc:signal", async (payload: unknown) => {
        const parsed = rtcSignalSchema.safeParse(payload);
        if (!parsed.success || !connection.signals.tryTake()) return;
        const session = await this.options.matchmaker.activeSession(subjectId);
        if (session?.mode !== "video") return;
        this.io.to(room(partnerOf(session, subjectId).subjectId)).emit("rtc:signal", parsed.data);
      }),
    );

    socket.on(
      "media:state",
      guard("media:state", async (payload: unknown) => {
        const parsed = mediaStateSchema.safeParse(payload);
        if (!parsed.success || !connection.typing.tryTake()) return;
        const session = await this.options.matchmaker.activeSession(subjectId);
        if (session)
          this.io.to(room(partnerOf(session, subjectId).subjectId)).emit("media:state", parsed.data);
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

  /** One pairing attempt; keeps retrying in the background while queued. */
  private async search(connection: Connection, fresh: boolean): Promise<"matched" | "queued"> {
    this.stopRetry(connection);
    const ticket = connection.ticket;
    if (!ticket) return "queued";

    const result = await this.options.matchmaker.join(ticket, { fresh });
    if (result.status === "matched") {
      this.announce(result.session);
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

  private announce(session: ChatSession): void {
    const base = {
      sessionId: session.sessionId,
      mode: session.mode,
      sharedInterests: session.sharedInterests,
    };
    this.io.to(room(session.caller.subjectId)).emit("match:found", { ...base, role: "caller" });
    this.io.to(room(session.callee.subjectId)).emit("match:found", { ...base, role: "callee" });
  }

  private async endSession(socket: ChatSocket, reason: EndReason): Promise<ChatSession | null> {
    const subjectId = socket.data.principal.subjectId;
    const session = await this.options.matchmaker.endSession(subjectId);
    if (session) this.notifyEnded(session, reason, subjectId);
    return session;
  }

  private participant(socket: ChatSocket) {
    return { subjectId: socket.data.principal.subjectId, deviceId: socket.data.principal.deviceId };
  }

  private stopRetry(connection: Connection): void {
    if (connection.retryTimer) clearTimeout(connection.retryTimer);
    connection.retryTimer = null;
  }
}
