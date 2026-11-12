export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Milliseconds until the next request would be allowed; 0 when allowed. */
  readonly retryAfterMs: number;
}

/** Sliding-window rate limiter. `key` must already be anonymised (hashed) by the caller. */
export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
}
