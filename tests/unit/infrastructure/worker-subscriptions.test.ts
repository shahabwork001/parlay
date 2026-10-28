import { describe, expect, it } from "vitest";
import type { WorkersConfig } from "../../../src/infrastructure/config/config.js";
import type { Infrastructure } from "../../../src/infrastructure/infrastructure.js";
import { WORKER_QUEUES } from "../../../src/infrastructure/messaging/worker-subscriptions.js";
import type { ModerationContext } from "../../../src/infrastructure/moderation/moderation-composition.js";
import { createLogger } from "../../../src/infrastructure/observability/logger.js";
import { createConsumers } from "../../../src/workers/consumers.js";

describe("worker subscriptions", () => {
  it("are exactly the queues the workers consume (the admin system view inspects these)", () => {
    const consumers = createConsumers({
      infrastructure: { database: { collection: () => ({}) } } as unknown as Infrastructure,
      moderation: {} as ModerationContext,
      config: { rabbitMq: { prefetch: 1, deliveryLimit: 1, retryDelayMs: 1 } } as WorkersConfig,
      logger: createLogger({ service: "test", level: "silent", pretty: false }),
      emailSender: { send: () => Promise.resolve() },
    });

    expect(consumers.map((consumer) => consumer.queue)).toEqual(WORKER_QUEUES);
    expect(WORKER_QUEUES).toContain("parley.moderation.moderation.report-submitted.v1");
  });
});
