/** First-party operational aggregates only; never conversation contents or raw addresses. */
export interface ProductMetrics {
  activity(subjectId: string): Promise<void>;
  attempt(): Promise<void>;
  matched(waitMs: number): Promise<void>;
  sessionEnded(sessionId: string, startedAt: Date): Promise<void>;
  rtc(sessionId: string, subjectId: string, outcome: "connected" | "failed"): Promise<void>;
}
