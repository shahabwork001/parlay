# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Changed

- **Breaking:** the backend is now Node.js 24 + Express 5 + TypeScript instead of .NET 10 (ADR 0001). Real-time transport will be Socket.IO with the Redis adapter instead of SignalR (ADR 0002). The unbuilt .NET scaffold was removed.

### Added

- Phase 1 foundation: Clean Architecture folders (domain, application, infrastructure, api, workers) with layering enforced by ESLint.
- Result pattern, entity/aggregate base types (UUID v7 ids, optimistic concurrency, domain events), paging primitives.
- zod-validated configuration that fails fast and lists every problem.
- Generic MongoDB repository with explicit document mapping and a startup index initializer.
- RabbitMQ messaging: topic exchange, versioned zod-validated events, publisher confirms, quorum-queue consumers with exponential-backoff retries and dead-lettering, automatic reconnect.
- pino structured logging without IPs, headers or secrets; optional OpenTelemetry (OTLP); RFC 7807 errors; Helmet security headers; CORS; compression; OpenAPI 3.1 + Scalar in development.
- Health endpoints `/health/live` and `/health/ready` (MongoDB, Redis, RabbitMQ) on the API and the workers.
- Graceful shutdown for both processes.
- Multi-target Docker image (api, workers; non-root), Compose stack with MongoDB, Redis, RabbitMQ, coturn and Mailpit, env bootstrap script, GitHub Actions CI.
- 63 unit tests and 11 Testcontainers integration tests.
- Documentation: README, CLAUDE.md, architecture, API, security, ADRs, feature docs and FEATURES.md.
