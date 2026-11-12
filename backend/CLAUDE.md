# CLAUDE.md - Parley backend

**After every change, update the affected feature doc and FEATURES.md before considering the task done.**
Also add an entry to `CHANGELOG.md` (Keep a Changelog) and, for significant technical choices, an ADR in `docs/decisions/`.

## What this is

Node.js 24 + Express 5 + TypeScript API, real-time gateway (Socket.IO, from Phase 3) and background workers for Parley, an anonymous random video/text chat platform for adults.
MongoDB is the primary store, Redis holds hot state (matchmaking, presence, rate limits, caches, Socket.IO adapter), RabbitMQ carries async events, coturn provides TURN/STUN.

## Commands

```bash
npm run check              # lint + format check + typecheck + unit tests
npm test                   # unit tests (no Docker)
npm run test:integration   # Testcontainers: real MongoDB, Redis, RabbitMQ (Docker required)
npm run build              # tsc -> dist/
docker compose up -d mongodb redis rabbitmq coturn mailpit   # infra for local runs
npm run dev:api            # http://localhost:8080 (reads .env.local), docs at /scalar
npm run dev:workers        # http://localhost:8081
```

## Architecture rules (Clean Architecture, enforced by ESLint `no-restricted-imports`)

- `src/domain`: entities, value objects, domain events, Result/AppError. **No imports from other layers and no frameworks** (only `uuid`).
- `src/application`: use cases organised **by feature folder** (`features/<feature>/...`): commands/queries + handlers, DTOs, zod input schemas, ports (`Repository<T>`, `EventPublisher`, `...Service`). Imports the domain only (plus zod). Never imports drivers (mongodb, ioredis, amqplib, express, socket.io).
- `src/infrastructure`: Mongo repositories, Redis services, RabbitMQ publisher/consumers, TURN credentials, email, payment providers, config, observability, health. Implements application ports; nothing outside it touches driver types except the hosts' composition.
- `src/api`: Express routers per feature, Socket.IO gateway, middleware, auth, composition (`server.ts`). Thin: validate, call handler, map `Result` to HTTP.
- `src/workers`: RabbitMQ consumers (moderation, analytics, cleanup) registered in `consumers.ts`; exposes only health endpoints.
- api and workers never import each other.

## Conventions

- Result pattern (`ok`, `fail`, `AppError` via `AppErrors.*`) for expected failures; throw only for exceptional cases. `sendAppError` maps to RFC 7807.
- CQRS-lite without a mediator: handlers are plain classes/functions constructed in the composition root and injected into routers (ADR 0004).
- Validate every request and socket event with zod (`validate()` middleware, `validatedInput()`).
- Configuration: add variables to `src/infrastructure/config/config.ts` (zod schema); never read `process.env` elsewhere. Secrets only from environment.
- Mongo: one collection per aggregate; repositories extend `MongoRepository` with explicit `toDocument`/`toAggregate`. Declare indexes (including TTL) in `MONGO_INDEXES`; applied on startup. Ids are UUID v7 strings. Updates use optimistic concurrency on `version`.
- Integration events: `defineIntegrationEvent("<area>.<event>.v<N>", zodSchema)`. Routing keys never change once published. Handlers must be idempotent (at-least-once delivery, retries with backoff, then dead-letter).
- Hot paths (socket events, matchmaking) never wait on MongoDB; persist via events.
- Logging: pino, structured fields, never log secrets, emails, IPs, fingerprints or headers.
- ESM with `.js` import suffixes, relative imports, `import type` for types, no `any`, no default exports in `src` except where a library requires it, no dead or commented-out code.

## Testing

- Unit (`tests/unit`): domain logic, handlers, pairing logic, moderation rules, rate limiter, HTTP behaviour via supertest with fakes.
- Integration (`tests/integration`): real Mongo/Redis/RabbitMQ via Testcontainers (`global-setup.ts` starts them once; use `testInfrastructureConfig()` for an isolated database).
- All tests must pass before a phase is marked done.

## Docs to keep current

`FEATURES.md`, `docs/features/<feature>.md`, `docs/architecture.md`, `docs/api.md`, `docs/security.md`, `docs/decisions/`, `CHANGELOG.md`.
