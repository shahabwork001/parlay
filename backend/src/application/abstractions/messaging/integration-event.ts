import type { z } from "zod";

/**
 * Describes an event published to the message broker. `routingKey` is stable and versioned
 * (e.g. `reports.created.v1`) and must never change once published; the schema validates the
 * payload on both publish and consume.
 */
export interface IntegrationEventDefinition<TPayload> {
  readonly routingKey: string;
  readonly schema: z.ZodType<TPayload>;
}

export interface IntegrationEvent<TPayload> {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export function defineIntegrationEvent<TPayload>(
  routingKey: string,
  schema: z.ZodType<TPayload>,
): IntegrationEventDefinition<TPayload> {
  if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*\.v\d+$/.test(routingKey)) {
    throw new Error(
      `Invalid routing key "${routingKey}". Use dot-separated lower-case segments ending in .vN.`,
    );
  }
  return { routingKey, schema };
}

export interface EventPublisher {
  publish<TPayload>(definition: IntegrationEventDefinition<TPayload>, payload: TPayload): Promise<void>;
}

/**
 * Handles one event type. Handlers must be idempotent: the broker delivers at least once.
 * Throwing causes a redelivery; after the delivery limit the message is dead-lettered.
 */
export interface IntegrationEventHandler<TPayload> {
  handle(event: IntegrationEvent<TPayload>): Promise<void>;
}
