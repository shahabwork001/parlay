import type { ChatSession, JoinResult, MatchTicket, Participant } from "./chat-types.js";

/**
 * Matchmaking and live-session state. Implementations must pair atomically: a participant is in
 * at most one session, and two concurrent joins can never both claim the same partner.
 */
export interface Matchmaker {
  /**
   * Tries to pair the ticket with a compatible waiting participant, otherwise queues it.
   * `fresh` resets the waiting time (a new search); retries keep it so the interest fallback applies.
   */
  join(ticket: MatchTicket, options: { readonly fresh: boolean }): Promise<JoinResult>;

  leaveQueue(subjectId: string): Promise<void>;

  activeSession(subjectId: string): Promise<ChatSession | null>;

  /** A live session, or one that ended within the report window. */
  findSession(sessionId: string): Promise<ChatSession | null>;

  /** Ends the participant's session (if any) for both sides and returns it. */
  endSession(subjectId: string): Promise<ChatSession | null>;

  /** The blocker never matches the blocked subject or device again. */
  block(blocker: Participant, blocked: Participant): Promise<void>;

  /** Marks participants as online; called periodically for every connected socket. */
  touchPresence(subjectIds: readonly string[]): Promise<void>;

  /** Ends sessions and drops queue tickets whose participants are no longer online. */
  sweepAbandoned(): Promise<ChatSession[]>;
}
