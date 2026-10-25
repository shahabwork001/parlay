import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineIntegrationEvent } from "../../../src/application/abstractions/messaging/integration-event.js";

describe("defineIntegrationEvent", () => {
  it.each(["reports.created.v1", "moderation.frame-flagged.v2", "audit.v1"])("accepts %s", (routingKey) => {
    expect(defineIntegrationEvent(routingKey, z.object({})).routingKey).toBe(routingKey);
  });

  it.each(["reports.created", "Reports.Created.v1", "reports..created.v1", "reports.*.v1", ""])(
    "rejects %s",
    (routingKey) => {
      expect(() => defineIntegrationEvent(routingKey, z.object({}))).toThrow(/Invalid routing key/);
    },
  );
});
