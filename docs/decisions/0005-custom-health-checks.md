# 0005: In-house health checks

Date: 2026-10-25. Status: Accepted.

## Context
Community health-check packages exist for MongoDB, Redis and RabbitMQ, but each pins specific client versions, which causes upgrade friction. Our checks are one call each.

## Decision
Implement `IHealthCheck` for MongoDB (`ping`), Redis (`PING`) and RabbitMQ (shared connection open) in Infrastructure, reusing the application's own clients.

## Consequences
Health checks exercise the same connections the app uses. Three small classes to maintain.
