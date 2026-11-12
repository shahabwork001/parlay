/**
 * In-memory token bucket for per-connection flood control (messages, typing). Connection-local by
 * design: a socket lives on one instance. Cross-instance limits use the Redis rate limiter.
 */
export class TokenBucket {
  #tokens: number;
  #updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.#tokens = capacity;
    this.#updatedAt = now();
  }

  tryTake(): boolean {
    const now = this.now();
    this.#tokens = Math.min(
      this.capacity,
      this.#tokens + ((now - this.#updatedAt) / 1000) * this.refillPerSecond,
    );
    this.#updatedAt = now;
    if (this.#tokens < 1) return false;
    this.#tokens -= 1;
    return true;
  }
}
