# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Phase 1 foundation: Clean Architecture solution (Domain, Application, Infrastructure, Api, Workers, UnitTests, IntegrationTests) on .NET 10 with central package management.
- Result pattern, base entity/aggregate types (Guid v7 ids, optimistic concurrency), paging primitives.
- Generic MongoDB repository with startup index initializer and BSON conventions.
- RabbitMQ messaging: topic exchange, publisher confirms, quorum-queue consumers with delivery limit and dead-lettering.
- Serilog structured logging, OpenTelemetry traces/metrics (OTLP optional), RFC 7807 errors, security headers, CORS, response compression, OpenAPI + Scalar.
- Health endpoints `/health/live` and `/health/ready` (MongoDB, Redis, RabbitMQ).
- Docker multi-target image (api, workers; non-root), Compose stack with MongoDB, Redis, RabbitMQ, coturn and Mailpit, env bootstrap script, GitHub Actions CI.
- Documentation: README, CLAUDE.md, architecture, API, security, ADRs, feature docs and FEATURES.md.

### Known issues
- NuGet (api.nuget.org) is unreachable from the current development network; the solution has not yet been restored, built or tested.
