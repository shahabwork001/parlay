/**
 * Socket.IO contract, mirroring the backend's `src/api/realtime/chat-events.ts`.
 * Keep both files in sync (see backend docs/api.md, "Socket.IO events").
 */
import type { ChatMode } from "@/lib/constants";

export type EndReason = "skipped" | "left" | "disconnected";

export type Ack<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export interface MatchFound {
  readonly sessionId: string;
  readonly mode: ChatMode;
  readonly role: "caller" | "callee";
  readonly sharedInterests: readonly string[];
  /** On-device screening threshold for this session (stricter in low-trust pools). */
  readonly safety: { readonly nsfwThreshold: number };
}

export interface ChatMessagePayload {
  readonly id: string;
  readonly text: string;
  readonly sentAt: string;
}

/** WebRTC signaling relayed through the server between the two video partners. */
export type RtcSignal =
  | {
      readonly description: {
        readonly type: "offer" | "answer" | "rollback";
        readonly sdp: string;
      };
    }
  | {
      readonly candidate: {
        readonly candidate: string;
        readonly sdpMid?: string | null;
        readonly sdpMLineIndex?: number | null;
        readonly usernameFragment?: string | null;
      };
    };

export interface MediaState {
  readonly audio: boolean;
  readonly video: boolean;
}

export interface JoinRequest {
  readonly mode: ChatMode;
  readonly language: string;
  readonly interests: readonly string[];
}

export interface ServerToClientEvents {
  "match:found": (payload: MatchFound) => void;
  "match:ended": (payload: { readonly sessionId: string; readonly reason: EndReason }) => void;
  "chat:message": (payload: ChatMessagePayload) => void;
  "chat:typing": (payload: { readonly typing: boolean }) => void;
  "rtc:signal": (payload: RtcSignal) => void;
  "media:state": (payload: MediaState) => void;
  /** Sent right before the server disconnects a banned person. */
  "moderation:banned": (payload: Record<string, never>) => void;
  /** A moderator warning after an upheld report; the person keeps chatting. */
  "moderation:warning": (payload: { readonly message: string }) => void;
}

export interface ClientToServerEvents {
  "queue:join": (
    payload: JoinRequest,
    ack: (result: Ack<{ status: "matched" | "queued" }>) => void,
  ) => void;
  "queue:leave": (ack: (result: Ack<null>) => void) => void;
  "match:next": (ack: (result: Ack<{ status: "matched" | "queued" }>) => void) => void;
  "match:block": (ack: (result: Ack<null>) => void) => void;
  "chat:message": (
    payload: { text: string },
    ack: (result: Ack<ChatMessagePayload>) => void,
  ) => void;
  "chat:typing": (payload: { typing: boolean }) => void;
  "rtc:signal": (payload: RtcSignal) => void;
  "media:state": (payload: MediaState) => void;
  "moderation:flag": (
    payload: { source: "nsfw-screening"; score: number },
    ack: (result: Ack<{ outcome: "recorded" | "banned" }>) => void,
  ) => void;
}

/** Errors the server reports in `connect_error.message`. */
export const CONNECT_ERRORS = {
  authRequired: "auth.required",
  termsOutdated: "terms.outdated",
  banned: "moderation.banned",
} as const;
