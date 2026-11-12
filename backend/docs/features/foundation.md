# Feature: Platform foundation

Status: Done
Last updated: 2026-10-25

## Purpose

Solution structure, configuration, logging, telemetry, health checks, error handling, Docker and CI that every other feature builds on.

## User stories / use cases

- As an operator, I can start the whole stack with one command.
- As an operator, I can see whether the API and its dependencies are healthy.
- As a developer, I get consistent ProblemDetails errors, structured logs and traces.

## API endpoints / hub methods / events involved

- GET /health/live - liveness, no dependency checks
- GET /health/ready - MongoDB, Redis, RabbitMQ; 503 when any is unhealthy
- GET /openapi.json and /scalar - API reference (development only)
- RabbitMQ: topic exchange parley.events, dead-letter exchange parley.dead-letter (no events yet)

## Data model

No collections yet. Base types: Entity (UUID v7 id), AggregateRoot (version for optimistic concurrency, domain events), Result/AppError, PageRequest/PagedResult. Repositories map aggregates to documents explicitly; ids are stored as string _id.

## Business rules

- Configuration comes from environment variables validated with zod at startup (fail fast, every problem listed); secrets only from environment.
- Unhandled exceptions return RFC 7807 ProblemDetails without internal details.
- Health: /health/live (process up) and /health/ready (MongoDB, Redis, RabbitMQ).
- Containers run as non-root.

## Current state (what works, what's missing, known issues)

Done: Node.js 24 + Express 5 + TypeScript (strict) with Clean Architecture folders (domain, application, infrastructure, api, workers) enforced by ESLint import rules; zod-validated configuration; pino structured logging (no IPs, headers or secrets); optional OpenTelemetry (OTLP); RFC 7807 errors; Helmet security headers; CORS locked to the frontend origin; compression; OpenAPI + Scalar; health checks; generic Mongo repository with optimistic concurrency; RabbitMQ publisher with confirms and quorum-queue consumers with exponential-backoff retries and dead-lettering; graceful shutdown; multi-target non-root Docker image; CI.

Verified: 63 unit tests and 11 Testcontainers integration tests pass; full Compose stack healthy.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
