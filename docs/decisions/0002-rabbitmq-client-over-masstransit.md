# 0002: RabbitMQ.Client instead of MassTransit

Date: 2026-10-25. Status: Accepted.

## Context
We need durable pub/sub for reports, moderation jobs, analytics, notifications and audit events, with retries and dead-lettering. MassTransit v9 moved to a commercial licence; v8 (Apache 2.0) is in maintenance with a published end of support. The project must use only free, open-source tools.

## Decision
Use the official `RabbitMQ.Client` (7.x, async API) behind `IEventPublisher` / `IIntegrationEventHandler<T>`:
- one durable topic exchange `parley.events`, routing key per event type and version;
- one quorum queue per subscriber with `x-delivery-limit` for retries and a direct dead-letter exchange;
- publisher confirms for at-least-once publishing;
- automatic connection and topology recovery.

## Consequences
Small, transparent messaging layer (about 300 lines) with no licensing risk. We own features MassTransit would provide (sagas, outbox, scheduling); if they become necessary we add them deliberately, for example a Mongo outbox.
