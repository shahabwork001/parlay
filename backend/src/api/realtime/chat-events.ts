import type { ChatMode, EndReason } from "../../application/features/chat/chat-types.js";
import type { MediaState, RtcSignal } from "../../application/features/chat/schemas.js";
import type { Principal } from "../../application/features/identity/ports.js";
import type { AccessIdentity } from "../../application/features/moderation/network.js";

/**
 * Socket.IO contract shared with the frontend (`src/services/realtime/chat-events.ts` there).
 * Inbound payloads are typed `unknown` on purpose: every one is validated with zod.
 */
export type Ack<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export type AckCallback<T> = (result: Ack<T>) => void;

export interface MatchFoundPayload {
  readonly sessionId: string;
  readonly mode: ChatMode;
  /** The caller waited longer and starts the WebRTC negotiation in video mode. */
  readonly role: "caller" | "callee";
  readonly sharedInterests: readonly string[];
  /** On-device screening settings for this session (stricter for low-trust pools). */
  readonly safety: { readonly nsfwThreshold: number };
}

export interface ChatMessagePayload {
  readonly id: string;
  readonly text: string;
  readonly sentAt: string;
}

export interface ServerToClientEvents {
  "match:found": (payload: MatchFoundPayload) => void;
  "match:ended": (payload: { readonly sessionId: string; readonly reason: EndReason }) => void;
  "chat:message": (payload: ChatMessagePayload) => void;
  "chat:typing": (payload: { readonly typing: boolean }) => void;
  "rtc:signal": (payload: RtcSignal) => void;
  "media:state": (payload: MediaState) => void;
  /** Sent right before the server disconnects a banned person. */
  "moderation:banned": (payload: Record<string, never>) => void;
  /** A moderator warning after an upheld report. */
  "moderation:warning": (payload: { readonly message: string }) => void;
}

export interface ClientToServerEvents {
  "queue:join": (payload: unknown, ack: AckCallback<{ status: "matched" | "queued" }>) => void;
  "queue:leave": (ack: AckCallback<null>) => void;
  "match:next": (ack: AckCallback<{ status: "matched" | "queued" }>) => void;
  "match:block": (ack: AckCallback<null>) => void;
  "chat:message": (payload: unknown, ack: AckCallback<ChatMessagePayload>) => void;
  "chat:typing": (payload: unknown) => void;
  "rtc:signal": (payload: unknown) => void;
  "media:state": (payload: unknown) => void;
  "moderation:flag": (payload: unknown, ack: AckCallback<{ outcome: "recorded" | "banned" }>) => void;
}

/** No server-to-server events: cross-instance delivery goes through the Redis adapter. */
export interface InterServerEvents {
  readonly __none?: never;
}

export interface SocketData {
  principal: Principal;
  identity: AccessIdentity;
}
