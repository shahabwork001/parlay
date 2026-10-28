import type { Redis } from "ioredis";
import type { BufferedMessage, RecentMessages } from "../../application/features/chat/recent-messages.js";

const KEEP = 20;
/** Long enough to cover the report window after the last message; then the buffer is gone. */
const TTL_SECONDS = 15 * 60;

interface StoredMessage {
  s: string;
  t: string;
  at: number;
}

/** A capped Redis list per session. Nothing here is ever written to durable storage. */
export class RedisRecentMessages implements RecentMessages {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "chat:recent",
  ) {}

  async append(sessionId: string, message: BufferedMessage): Promise<void> {
    const key = `${this.prefix}:${sessionId}`;
    const stored: StoredMessage = {
      s: message.senderSubjectId,
      t: message.text,
      at: message.sentAt.getTime(),
    };
    await this.redis
      .multi()
      .rpush(key, JSON.stringify(stored))
      .ltrim(key, -KEEP, -1)
      .expire(key, TTL_SECONDS)
      .exec();
  }

  async list(sessionId: string): Promise<BufferedMessage[]> {
    const entries = await this.redis.lrange(`${this.prefix}:${sessionId}`, 0, -1);
    return entries.map((entry) => {
      const stored = JSON.parse(entry) as StoredMessage;
      return { senderSubjectId: stored.s, text: stored.t, sentAt: new Date(stored.at) };
    });
  }
}
