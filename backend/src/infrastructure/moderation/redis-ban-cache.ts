import type { Redis } from "ioredis";
import type { BanCache, CachedBan } from "../../application/features/moderation/ports.js";
import { type Ban, type BanTarget, targetKey } from "../../domain/moderation/ban.js";

/*
 * One sorted set per ban target, `ban:{kind}:{value}`: members are `{banId}|{mode}`, scored by
 * expiry in ms (+inf for permanent). A lookup is one ZRANGEBYSCORE per target in a single round trip.
 */
export class RedisBanCache implements BanCache {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "ban",
  ) {}

  async store(ban: Ban, now: Date): Promise<void> {
    if (!ban.isActive(now)) return;
    const score = ban.expiresAt ? ban.expiresAt.getTime() : "+inf";
    const pipeline = this.redis.multi();
    for (const target of ban.targets) {
      const key = this.key(target);
      pipeline.zremrangebyscore(key, "-inf", now.getTime());
      pipeline.zadd(key, score, `${ban.id}|${ban.mode}`);
    }
    await pipeline.exec();
  }

  async remove(ban: Ban): Promise<void> {
    const pipeline = this.redis.multi();
    for (const target of ban.targets) pipeline.zrem(this.key(target), `${ban.id}|${ban.mode}`);
    await pipeline.exec();
  }

  async lookup(targets: readonly BanTarget[], now: Date): Promise<CachedBan[]> {
    if (targets.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const target of targets) pipeline.zrangebyscore(this.key(target), `(${now.getTime()}`, "+inf");
    const results = (await pipeline.exec()) ?? [];

    const bans = new Map<string, CachedBan>();
    for (const [error, members] of results) {
      if (error) throw error;
      for (const member of members as string[]) {
        const [banId = "", mode] = member.split("|");
        bans.set(banId, { banId, mode: mode === "shadow" ? "shadow" : "full" });
      }
    }
    return [...bans.values()];
  }

  private key(target: BanTarget): string {
    return `${this.prefix}:${targetKey(target)}`;
  }
}
