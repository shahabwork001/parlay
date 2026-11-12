# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added (2026-11-12: repository and delivery preparation)

- Root monorepo retains both project histories; development uses `dev` and reviewed production releases use `main`.
- Shared Jenkins CI validates both applications; only non-PR `main` builds can deliver exact SHA-labelled images to Hetzner. Publishing and Jenkins commissioning require authenticated administrator setup. See `../docs/GITHUB_JENKINS.md`.

### Added (Phase 7: site configuration; monetisation deferred)

- Site configuration: maintenance mode with a message, announcement banner, switches for text chat, video chat and new accounts. `GET /api/v1/site` (public) and `GET/PUT /api/v1/admin/site` (`flags.manage`), audit-logged.
- Enforcement: `site.maintenance` refuses connections and searches for non-staff, `chat.mode_disabled` refuses searches in a switched-off mode, `auth.registration_closed` (403) when sign-up is closed.
- ADR 0015: launch free; plans, payments, premium features and ad slots deferred.
- Tests: site routes (public view, permission, audit, closed registration) and gateway enforcement (197 unit and 68 integration in total).

### Fixed

- Gateway integration tests could pair a test's clients with a stale ticket from the previous test; teardown now waits until the queues are empty.

### Added (Phase 6: admin panel)

- Admin API under `/api/v1/admin`, each route behind a permission and a two-factor session: dashboard, moderation queue and report detail, report decisions (dismiss, warn, ban) and minor-safety escalation, bans (list, manual ban, lift) and appeal decisions, user search and detail with sign-in history, text rules editor, staff roles, audit log, system health.
- Read model over MongoDB projections, live stats in Redis (matches per minute, average wait), RabbitMQ queue inspection, TURN and workers health checks.
- `moderation:warning` socket event for upheld reports.
- `create-staff` tool: staff account with 2FA enabled, credentials printed once.
- ADR 0014. Tests: admin use cases, admin routes (permissions, 2FA, mapping), read model, live stats, queue inspector, worker subscription list (194 unit and 67 integration in total).

### Changed

- Pairing returns how long the waiting person waited; the gateway records match stats.
- Worker consumers are built from `WORKER_SUBSCRIPTIONS`, shared with the system view.

### Fixed

- Lifting an already lifted ban returned 404 instead of 409.
- Phase 5 docs had lost table rows (API endpoints, events, configuration) to a broken replacement; restored.

### Added (Phase 5: moderation and safety)

- Reports: `POST /api/v1/reports` with categories, snapshot and the last messages as evidence; ends the chat and blocks the partner; 10-minute report window after a chat ends.
- Moderation worker: `ScoreReport` with a pluggable `ContentClassifier` (heuristic skin-tone and text-rule implementation), review priority and tiers, automatic suspension after reports from 3 people within an hour.
- Bans by account, device, IP and subnet (keyed hashes), temporary, permanent or shadow; Redis write-through cache checked on connect and every search; enforcement via the Socket.IO Redis emitter; `GET /api/v1/me/ban` and `POST /api/v1/me/ban/appeal`.
- Trust scores per account and device (clean sessions, reports, flags, blocked messages); low-trust and shadow matchmaking pools.
- Text moderation rules stored in MongoDB: slurs rejected, profanity masked, links, emails, phone numbers and social handles removed, repeat-spam detection.
- Rate limits per account, device and network for searches, messages and reports.
- On-device screening flags (`moderation:flag`) with automatic 24-hour bans after 3 flags in 10 minutes.
- Minor-safety workflow: critical priority, instant suspension, 365-day evidence preservation, restricted and audit-logged evidence access; documented in `docs/minor-safety-workflow.md`.
- Evidence store with TTL retention, audit log collection, `GET /api/v1/moderation/reports/{id}/evidence`.
- ADRs 0010 (written down), 0012 and 0013.
- 29 new unit tests and 13 new integration tests (174 unit and 61 integration in total).

### Changed

- Matchmaking participants carry kind and network hashes; queues are keyed by pool; ended sessions are kept for the report window.
- The Phase 3 `filterChatText` is replaced by `moderateText` with stored rules.

### Fixed

- ADR index listed ADR 0011 twice and linked ADR 0010, which had not been written.

### Added (Phase 4: video chat)

- `GET /api/v1/rtc/ice-servers`: STUN plus short-lived TURN credentials in coturn's REST scheme (HMAC-SHA1 over `expiry:subject`).
- Socket.IO `rtc:signal` relay (offer, answer, ICE candidates), validated and limited to video sessions, plus `media:state` (muted, camera off).
- Configuration: `TURN_SECRET`, `TURN_URLS`, `STUN_URLS`, `TURN_CREDENTIAL_TTL_SECONDS`.
- 5 new unit tests and 2 new integration tests (145 unit and 48 integration in total).

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
