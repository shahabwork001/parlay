# Feature: System health

Status: Done
Last updated: 2026-10-25

## Purpose

Status of MongoDB, Redis, RabbitMQ, TURN and worker queues.

## User stories / use cases

- As an operator, I can see which dependency is failing.

## API endpoints / hub methods / events involved

GET /api/v1/admin/system (`system.view`); `QueueInspector` (`RabbitMqQueueInspector`); `TcpHealthCheck`, `HttpHealthCheck`

## Data model

None stored. Queue names come from `WORKER_SUBSCRIPTIONS`, shared with the workers.

## Business rules

- Public /status shows component status only; the admin view adds queue depths and details.

## Current state (what works, what's missing, known issues)

Done: MongoDB, Redis, RabbitMQ, TURN (TCP reachability, `TURN_HEALTH_HOST`) and the workers (`WORKERS_HEALTH_URL`), plus messages and consumers for every worker queue and its dead-letter queue. Public readiness stays at /health/ready.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Readiness endpoints (Phase 1).
- 2026-10-28: Implemented in Phase 6 (admin panel).
