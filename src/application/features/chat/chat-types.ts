export const CHAT_MODES = ["text", "video"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

/**
 * Matchmaking pools never mix: low-trust people are matched with each other, and shadow-banned
 * people only with other shadow-banned people.
 */
export const MATCH_POOLS = ["standard", "low-trust", "shadow"] as const;
export type MatchPool = (typeof MATCH_POOLS)[number];

/**
 * Someone in matchmaking or a chat. Partners never learn each other's ids; the network hashes exist
 * only so moderators can act on a report.
 */
export interface Participant {
  readonly subjectId: string;
  readonly deviceId: string;
  readonly kind: "user" | "anonymous";
  /** Keyed hash of the IP address. */
  readonly networkHash: string;
  /** Keyed hash of the /24 (IPv4) or /64 (IPv6) subnet. */
  readonly subnetHash: string;
}

export interface MatchTicket extends Participant {
  readonly mode: ChatMode;
  readonly pool: MatchPool;
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
  readonly startedAt: Date;
}

export type JoinResult =
  /** `waitedMs`: how long the partner who was waiting (the caller) had been in the queue. */
  | { readonly status: "matched"; readonly session: ChatSession; readonly waitedMs: number }
  | { readonly status: "queued" }
  | { readonly status: "in_session"; readonly sessionId: string };

export type EndReason = "skipped" | "left" | "disconnected";

export const partnerOf = (session: ChatSession, subjectId: string): Participant =>
  session.caller.subjectId === subjectId ? session.callee : session.caller;

export const participantOf = (session: ChatSession, subjectId: string): Participant =>
  session.caller.subjectId === subjectId ? session.caller : session.callee;

export const isParticipant = (session: ChatSession, subjectId: string): boolean =>
  session.caller.subjectId === subjectId || session.callee.subjectId === subjectId;

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
  /** How long an ended session can still be reported. */
  readonly reportWindowSeconds: number;
}
