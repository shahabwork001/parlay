export const CHAT_MODES = ["text", "video"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

/** Someone in matchmaking or a chat. Partners never learn each other's ids. */
export interface Participant {
  readonly subjectId: string;
  readonly deviceId: string;
}

export interface MatchTicket extends Participant {
  readonly mode: ChatMode;
  /** ISO 639-1 code or `any`. */
  readonly language: string;
  readonly interests: readonly string[];
}

export interface ChatSession {
  readonly sessionId: string;
  readonly mode: ChatMode;
  /** The participant who waited longer; creates the WebRTC offer in video mode. */
  readonly caller: Participant;
  readonly callee: Participant;
  readonly sharedInterests: readonly string[];
}

export type JoinResult =
  | { readonly status: "matched"; readonly session: ChatSession }
  | { readonly status: "queued" }
  | { readonly status: "in_session"; readonly sessionId: string };

export type EndReason = "skipped" | "left" | "disconnected";

export const partnerOf = (session: ChatSession, subjectId: string): Participant =>
  session.caller.subjectId === subjectId ? session.callee : session.caller;

/** Tunable matchmaking rules (configuration today, admin-editable in Phase 6). */
export interface MatchmakingPolicy {
  /** How long someone with interests waits for a shared-interest match before going random. */
  readonly interestFallbackMs: number;
  /** A partner you just left is not matched with you again within this window. */
  readonly recentPartnerWindowMs: number;
  /** How many waiting tickets one pairing attempt inspects (oldest first). */
  readonly scanLimit: number;
  /** Upper bound on a chat session's lifetime in Redis. */
  readonly sessionTtlSeconds: number;
}
