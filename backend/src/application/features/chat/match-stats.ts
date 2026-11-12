/** Records matchmaking throughput for the admin dashboard. Best effort: failures never block chat. */
export interface MatchStatsRecorder {
  /** `waitMs` is how long the earlier of the two people waited. */
  recordMatch(waitMs: number, now: Date): Promise<void>;
}
