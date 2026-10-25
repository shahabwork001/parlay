import { randomUUID } from "node:crypto";
import { inject } from "vitest";
import type { InfrastructureConfig } from "../../src/infrastructure/config/config.js";
import { createLogger } from "../../src/infrastructure/observability/logger.js";

export const silentLogger = createLogger({ service: "integration-tests", level: "silent", pretty: false });

/** Infrastructure config pointing at the shared test containers, with an isolated database per call. */
export function testInfrastructureConfig(
  overrides: Partial<InfrastructureConfig["rabbitMq"]> = {},
): InfrastructureConfig {
  return {
    environment: "test",
    logLevel: "silent",
    mongo: { uri: inject("mongoUri"), database: `parley_test_${randomUUID().replaceAll("-", "")}` },
    redis: { url: inject("redisUrl") },
    rabbitMq: { url: inject("rabbitMqUrl"), prefetch: 8, deliveryLimit: 3, retryDelayMs: 10, ...overrides },
  };
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Condition not met within ${timeoutMs} ms.`);
}
