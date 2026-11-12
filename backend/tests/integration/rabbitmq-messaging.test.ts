import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineIntegrationEvent,
  type IntegrationEvent,
} from "../../src/application/abstractions/messaging/integration-event.js";
import { createInfrastructure, type Infrastructure } from "../../src/infrastructure/infrastructure.js";
import { RabbitMqConsumer } from "../../src/infrastructure/messaging/rabbitmq-consumer.js";
import { EVENTS_EXCHANGE } from "../../src/infrastructure/messaging/rabbitmq-topology.js";
import { silentLogger, testInfrastructureConfig, waitFor } from "./support.js";

const PingEvent = defineIntegrationEvent("tests.ping.v1", z.object({ text: z.string() }));
const DELIVERY_LIMIT = 2;

describe("RabbitMQ messaging", () => {
  let infrastructure: Infrastructure;

  beforeAll(async () => {
    infrastructure = await createInfrastructure(
      testInfrastructureConfig({ deliveryLimit: DELIVERY_LIMIT }),
      silentLogger,
      "messaging-tests",
    );
    await waitFor(() => infrastructure.rabbitMq.isConnected);
  });

  afterAll(async () => {
    await infrastructure.close();
  });

  async function startConsumer(handle: (event: IntegrationEvent<{ text: string }>) => Promise<void>) {
    const consumer = new RabbitMqConsumer(
      infrastructure.rabbitMq,
      {
        subscriber: `tests-${randomUUID()}`,
        definition: PingEvent,
        handler: { handle },
        prefetch: 4,
        deliveryLimit: DELIVERY_LIMIT,
        retryDelayMs: 10,
      },
      silentLogger,
    );
    await consumer.start();
    return consumer;
  }

  async function deadLetterCount(queue: string): Promise<number> {
    const channel = await infrastructure.rabbitMq.createChannel();
    try {
      return (await channel.checkQueue(`${queue}.dead-letter`)).messageCount;
    } finally {
      await channel.close();
    }
  }

  it("delivers a published event to the subscribed handler", async () => {
    const received: IntegrationEvent<{ text: string }>[] = [];
    const consumer = await startConsumer((event) => {
      received.push(event);
      return Promise.resolve();
    });

    await infrastructure.eventPublisher.publish(PingEvent, { text: "hello" });

    await waitFor(() => received.length === 1);
    expect(received[0]?.payload).toEqual({ text: "hello" });
    expect(received[0]?.eventId).toMatch(/^[0-9a-f-]{36}$/);
    await consumer.stop();
  });

  it("redelivers after a transient handler failure", async () => {
    let attempts = 0;
    const consumer = await startConsumer(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error("transient")) : Promise.resolve();
    });

    await infrastructure.eventPublisher.publish(PingEvent, { text: "retry me" });

    await waitFor(() => attempts === 2);
    expect(await deadLetterCount(consumer.queue)).toBe(0);
    await consumer.stop();
  });

  it("dead-letters a message once the delivery limit is exceeded", async () => {
    let attempts = 0;
    const consumer = await startConsumer(() => {
      attempts += 1;
      return Promise.reject(new Error("permanent"));
    });

    await infrastructure.eventPublisher.publish(PingEvent, { text: "poison" });

    await waitFor(async () => (await deadLetterCount(consumer.queue)) === 1);
    expect(attempts).toBe(DELIVERY_LIMIT);
    await consumer.stop();
  });

  it("dead-letters malformed messages without calling the handler", async () => {
    let calls = 0;
    const consumer = await startConsumer(() => {
      calls += 1;
      return Promise.resolve();
    });

    const channel = await infrastructure.rabbitMq.createChannel();
    channel.publish(EVENTS_EXCHANGE, PingEvent.routingKey, Buffer.from("{not json"));
    channel.publish(
      EVENTS_EXCHANGE,
      PingEvent.routingKey,
      Buffer.from(JSON.stringify({ payload: { text: 1 } })),
    );
    await channel.close();

    await waitFor(async () => (await deadLetterCount(consumer.queue)) === 2);
    expect(calls).toBe(0);
    await consumer.stop();
  });

  it("rejects payloads that do not match the event schema before publishing", async () => {
    await expect(
      infrastructure.eventPublisher.publish(PingEvent, { text: 42 } as unknown as { text: string }),
    ).rejects.toThrow();
  });
});
