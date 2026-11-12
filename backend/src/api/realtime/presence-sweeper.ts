import type { Redis } from "ioredis";
import type { Matchmaker } from "../../application/features/chat/matchmaker.js";
import { runExclusively } from "../../infrastructure/caching/redis-lock.js";
import type { Logger } from "../../infrastructure/observability/logger.js";
import type { ChatGateway } from "./chat-gateway.js";

/**
 * Ends chats and drops queue tickets whose participant vanished without a clean disconnect (an API
 * instance crashed or lost its network). Runs on one instance at a time via a Redis lease.
 */
export class PresenceSweeper {
  #timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly matchmaker: Matchmaker,
    private readonly gateway: ChatGateway,
    private readonly logger: Logger,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    this.#timer = setInterval(() => {
      void this.sweepOnce().catch((error: unknown) => {
        this.logger.warn({ err: error }, "Presence sweep failed");
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
  }

  async sweepOnce(): Promise<void> {
    await runExclusively(this.redis, "chat-presence-sweeper", this.intervalMs, async () => {
      const ended = await this.matchmaker.sweepAbandoned();
      for (const session of ended) this.gateway.notifyEnded(session, "disconnected");
      if (ended.length > 0) this.logger.info({ count: ended.length }, "Ended abandoned chat sessions");
    });
  }
}
