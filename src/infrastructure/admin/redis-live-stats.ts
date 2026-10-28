import type { Redis } from "ioredis";
import type { LiveStats } from "../../application/features/admin/admin-read-model.js";
import { CHAT_MODES, MATCH_POOLS } from "../../application/features/chat/chat-types.js";
import type { MatchStatsRecorder } from "../../application/features/chat/match-stats.js";

const MINUTE = 60_000;
/** Per-minute counters are kept for two hours (the dashboard shows the last hour). */
const COUNTER_TTL_SECONDS = 2 * 60 * 60;

const minuteOf = (time: Date) => Math.floor(time.getTime() / MINUTE);

/*
 * Keys:
 *   stats:matches:{minute}  STR  matches made in that minute
 *   stats:wait:{minute}     STR  total wait (ms) of the earlier person, for the average
 * Live values come from the matchmaking keys (prefix `mm`).
 */
export class RedisLiveStats implements LiveStats, MatchStatsRecorder {
  constructor(
    private readonly redis: Redis,
    private readonly matchmakingPrefix = "mm",
  ) {}

  async recordMatch(waitMs: number, now: Date): Promise<void> {
    const minute = minuteOf(now);
    await this.redis
      .multi()
      .incr(`stats:matches:${minute}`)
      .expire(`stats:matches:${minute}`, COUNTER_TTL_SECONDS)
      .incrby(`stats:wait:${minute}`, Math.max(0, Math.round(waitMs)))
      .expire(`stats:wait:${minute}`, COUNTER_TTL_SECONDS)
      .exec();
  }

  /** Counts presence keys with SCAN (non-blocking); fine for a dashboard polled every few seconds. */
  async online(): Promise<number> {
    let count = 0;
    let cursor = "0";
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        `${this.matchmakingPrefix}:presence:*`,
        "COUNT",
        500,
      );
      cursor = next;
      count += keys.length;
    } while (cursor !== "0");
    return count;
  }

  async waiting(): Promise<{ text: number; video: number }> {
    const pipeline = this.redis.pipeline();
    for (const mode of CHAT_MODES)
      for (const pool of MATCH_POOLS) pipeline.zcard(`${this.matchmakingPrefix}:queue:${mode}:${pool}`);
    const results = (await pipeline.exec()) ?? [];
    const counts = results.map(([, value]) => (typeof value === "number" ? value : 0));
    const sum = (offset: number) =>
      counts.slice(offset, offset + MATCH_POOLS.length).reduce((a, b) => a + b, 0);
    return { text: sum(0), video: sum(MATCH_POOLS.length) };
  }

  activeSessions(): Promise<number> {
    return this.redis.scard(`${this.matchmakingPrefix}:sessions`);
  }

  async matchesPerMinute(minutes: number, now: Date): Promise<number[]> {
    return (await this.series("matches", minutes, now)).map(Number);
  }

  async averageWaitMs(minutes: number, now: Date): Promise<number | null> {
    const [matches, waits] = await Promise.all([
      this.series("matches", minutes, now),
      this.series("wait", minutes, now),
    ]);
    const total = matches.reduce((sum, value) => sum + value, 0);
    if (total === 0) return null;
    return Math.round(waits.reduce((sum, value) => sum + value, 0) / total);
  }

  private async series(kind: "matches" | "wait", minutes: number, now: Date): Promise<number[]> {
    const current = minuteOf(now);
    const keys = Array.from(
      { length: minutes },
      (_, index) => `stats:${kind}:${current - minutes + 1 + index}`,
    );
    return (await this.redis.mget(...keys)).map((value) => Number(value ?? 0));
  }
}
