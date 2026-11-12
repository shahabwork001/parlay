import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { RateLimitDecision, RateLimiter } from "../../application/abstractions/rate-limiter.js";

/**
 * Sliding-window log in a sorted set, evaluated atomically in Lua:
 * drop entries older than the window, admit if under the limit, otherwise report when the oldest
 * entry leaves the window. Uses Redis server time so all API instances agree.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local member = ARGV[3]
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, limit - count - 1, 0}
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retry = tonumber(oldest[2]) + window - now
return {0, 0, retry}
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "rl",
  ) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const [allowed, remaining, retryAfterMs] = (await this.redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      `${this.prefix}:${key}`,
      limit,
      windowMs,
      randomUUID(),
    )) as [number, number, number];
    return { allowed: allowed === 1, remaining, retryAfterMs: Math.max(retryAfterMs, 0) };
  }
}
