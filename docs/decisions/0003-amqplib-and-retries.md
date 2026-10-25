# 0003: amqplib and consumer-counted retries

Date: 2026-10-25. Status: Accepted.

## Context

We need durable pub/sub for reports, moderation jobs, analytics, notifications and audit events, with retries and dead-lettering, using only free tools. amqplib 2 adds built-in connection recovery. In testing, RabbitMQ 4 did not count `basic.nack` requeues toward a quorum queue's `x-delivery-limit`: a failing message looped thousands of times per second and was never dead-lettered.

## Decision

- `amqplib` behind the `EventPublisher` and `IntegrationEventHandler` ports.
- One durable topic exchange `parley.events`, one quorum queue per subscriber, and a direct dead-letter exchange routing to `{queue}.dead-letter`.
- Publisher confirms with a 10 s timeout.
- Retries are counted by the consumer: on failure it waits with exponential backoff, republishes with an incremented `x-parley-attempt` header (confirmed), then acks. After the configured number of attempts, or for malformed messages, it nacks without requeue so the message is dead-lettered.
- The queue's `x-delivery-limit` stays as a safety net for consumers that crash mid-message.

## Consequences

Retries back off instead of spinning, and poison messages always land in a dead-letter queue we can inspect and replay. A retried message moves to the tail of its queue, so per-queue ordering is not guaranteed; handlers must not depend on it.
