import { Redis } from "ioredis";
import type { HealthCheck, HealthCheckResult } from "../health/health-check.js";
import type { Logger } from "../observability/logger.js";

/**
 * Commands fail fast while disconnected (no offline queue) so hot paths never stall;
 * the client keeps reconnecting with capped backoff in the background.
 */
export function createRedisClient(url: string, logger: Logger): Redis {
  const client = new Redis(url, {
    connectionName: "parley",
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });
  client.on("error", (error: Error) => {
    logger.warn({ err: error }, "Redis connection error");
  });
  return client;
}

export class RedisHealthCheck implements HealthCheck {
  readonly name = "redis";

  constructor(private readonly client: Redis) {}

  async check(): Promise<HealthCheckResult> {
    await this.client.ping();
    return { status: "Healthy" };
  }
}
