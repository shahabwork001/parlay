# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added (Phase 3: matchmaking and text chat)

- Socket.IO gateway with the Redis adapter; handshake authentication requiring a current Terms acceptance; zod validation and acks on every event.
- Redis matchmaking in atomic Lua scripts: separate text and video queues, shared-interest preference, language filter, random fallback after `MATCH_INTEREST_FALLBACK_MS`, blocks in both directions, no immediate re-match of recent partners. Verified free of double matches under 200 concurrent joins (ADR 0011).
- Text chat relay with delivery acks, typing indicator, link removal, profanity masking and per-connection flood control.
- Next, Stop and Block; partners are notified immediately on Next, leave, block or disconnect.
- Presence keys and a lease-guarded sweeper that ends sessions of participants on crashed instances.
- Blocks persisted asynchronously by the workers (`chat.partner-blocked.v1` to MongoDB `blocks`).
- 11 new unit tests and 22 new integration tests (140 unit and 46 integration in total).

### Added (Phase 2: identity)

- Anonymous device sessions behind the 18+ and Terms gate; device fingerprints stored only as HMACs.
- Accounts: registration without account enumeration, email confirmation, sign-in with lockout and timing equalisation, password reset that signs out everywhere.
- 15-minute JWT access tokens and rotating refresh tokens (httpOnly, Secure, SameSite=Strict cookie) with reuse detection (ADR 0010).
- Roles (SuperAdmin, Admin, Moderator, Support), permission catalogue and `requirePermission` middleware requiring multi-factor sessions for staff.
- TOTP two-factor authentication with encrypted secrets and single-use recovery codes.
- Redis sliding-window rate limiting on every auth endpoint, scaled by `RATE_LIMIT_MULTIPLIER`.
- Transactional email through RabbitMQ to the workers and SMTP (Mailpit locally).
- Seed tool for the first SuperAdmin; `init-env.sh` now adds missing keys to an existing `.env`.
- 66 new unit tests and 13 new integration tests (129 unit and 24 integration in total).

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
