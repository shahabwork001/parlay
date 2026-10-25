# Feature: Platform foundation
Status: Blocked
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
- GET /openapi/v1.json and /scalar - API reference (Development only)
- RabbitMQ: topic exchange parley.events, dead-letter exchange parley.dead-letter (no events yet)

## Data model
No collections yet. Base types: Entity (Guid v7 id), AggregateRoot (Version for optimistic concurrency, domain events), Result/Error, PageRequest/PagedResult. Mongo conventions: camelCase, enums as strings, Guid standard representation.

## Business rules
- Configuration comes from IOptions<T> bound to appsettings + environment variables; secrets only from environment.
- Unhandled exceptions return RFC 7807 ProblemDetails without internal details.
- Health: /health/live (process up) and /health/ready (MongoDB, Redis, RabbitMQ).
- Containers run as non-root.

## Current state (what works, what's missing, known issues)
Written: Clean Architecture solution (Domain, Application, Infrastructure, Api, Workers, UnitTests, IntegrationTests), central package management, Serilog + OpenTelemetry, ProblemDetails, security headers, CORS, compression, OpenAPI/Scalar, health checks, generic Mongo repository, RabbitMQ publisher (confirms) and consumer (quorum queues + dead-lettering), Dockerfile, compose, CI.

Blocked: api.nuget.org and globalcdn.nuget.org are unreachable from this network, so packages cannot be restored and the solution has not been compiled or tested yet. Package versions in Directory.Packages.props must be verified on first restore.

## Changelog
- 2026-10-25: Feature documented (Phase 1 scaffolding).
