import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { EventCounter } from "../../application/features/moderation/ports.js";

/** Sliding-window event count in a sorted set (score = time), trimmed on every increment. */
export class RedisEventCounter implements EventCounter {
  constructor(
    private readonly redis: Redis,
    private readonly now: () => number = Date.now,
  ) {}

  async increment(key: string, windowMs: number): Promise<number> {
    const now = this.now();
    const redisKey = `counter:${key}`;
    const results = await this.redis
      .multi()
      .zremrangebyscore(redisKey, "-inf", now - windowMs)
      .zadd(redisKey, now, `${now}:${randomUUID()}`)
      .zcard(redisKey)
      .pexpire(redisKey, windowMs)
      .exec();
    const count = results?.[2]?.[1];
    return typeof count === "number" ? count : 1;
  }
}
