# 0001: Clean Architecture with repository pattern

Date: 2026-10-25. Status: Accepted.

## Context
The platform has several delivery mechanisms (REST, SignalR, background consumers) over the same business rules, and infrastructure (Mongo, Redis, RabbitMQ, payment providers) that must stay swappable.

## Decision
Five projects: Domain (no dependencies), Application (use cases by feature folder, ports), Infrastructure (adapters), Api and Workers (hosts). A generic `IRepository<T>` for aggregates plus specific repository interfaces per aggregate. No Mongo, Redis or RabbitMQ types outside Infrastructure.

## Consequences
Business logic is unit-testable without infrastructure. Adding an adapter (e.g. Stripe) touches only Infrastructure and DI. Slightly more ceremony per feature.
