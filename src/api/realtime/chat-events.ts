import type { ChatMode, EndReason } from "../../application/features/chat/chat-types.js";
import type { Principal } from "../../application/features/identity/ports.js";

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
}

export interface ClientToServerEvents {
  "queue:join": (payload: unknown, ack: AckCallback<{ status: "matched" | "queued" }>) => void;
  "queue:leave": (ack: AckCallback<null>) => void;
  "match:next": (ack: AckCallback<{ status: "matched" | "queued" }>) => void;
  "match:block": (ack: AckCallback<null>) => void;
  "chat:message": (payload: unknown, ack: AckCallback<ChatMessagePayload>) => void;
  "chat:typing": (payload: unknown) => void;
}

/** No server-to-server events: cross-instance delivery goes through the Redis adapter. */
export interface InterServerEvents {
  readonly __none?: never;
}

export interface SocketData {
  principal: Principal;
}
