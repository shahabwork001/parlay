# CLAUDE.md - Parley backend

**After every change, update the affected feature doc and FEATURES.md before considering the task done.**
Also add an entry to `CHANGELOG.md` (Keep a Changelog) and, for significant technical choices, an ADR in `docs/decisions/`.

## What this is
.NET 10 API + SignalR + background workers for Parley, an anonymous random video/text chat platform for adults.
MongoDB is the primary store, Redis holds hot state (matchmaking, presence, rate limits, caches), RabbitMQ carries async events, coturn provides TURN/STUN.

## Commands
```bash
dotnet build Parley.slnx                         # warnings are errors
dotnet test tests/Parley.UnitTests               # fast, no Docker
dotnet test tests/Parley.IntegrationTests        # needs Docker (Testcontainers)
dotnet format Parley.slnx --verify-no-changes    # lint
docker compose up -d mongodb redis rabbitmq coturn mailpit   # infra for local runs
dotnet run --project src/Parley.Api              # http://localhost:8080, docs at /scalar
```

## Architecture rules (Clean Architecture)
- `Parley.Domain`: entities, value objects, enums, domain events. **No package or project references.**
- `Parley.Application`: use cases organised **by feature folder** (`Features/<Feature>/...`): commands/queries + handlers, DTOs, validators, ports (`IRepository<T>`, `IEventPublisher`, `I...Service`). References Domain only.
- `Parley.Infrastructure`: Mongo repositories, Redis services, RabbitMQ publisher/consumers, TURN credentials, email, payment providers, observability. **No Mongo/Redis/RabbitMQ types leak out of this project**; everything is exposed through Application interfaces.
- `Parley.Api`: endpoints (minimal APIs grouped per feature), SignalR hubs, middleware, auth, DI composition. Thin: validate, call handler, map `Result` to HTTP.
- `Parley.Workers`: hosts RabbitMQ consumers (moderation, analytics, cleanup). Exposes only health endpoints.

## Conventions
- Result pattern (`Result`, `Result<T>`, `Error`) for expected failures; exceptions only for exceptional cases. `Error.ToProblem()` maps to RFC 7807.
- CQRS-lite without a mediator library: handlers are plain classes injected into endpoints (ADR 0007).
- Validation with FluentValidation on every endpoint and hub method input.
- Config via `IOptions<T>` + `ValidateDataAnnotations().ValidateOnStart()`. Secrets only from environment variables / user-secrets. Never hardcode secrets.
- Mongo: one collection per aggregate, indexes declared in an `IMongoIndexDefinition` (applied on startup, including TTL indexes). Ids are Guid v7. Updates use optimistic concurrency on `Version`.
- Integration events implement `IIntegrationEvent` with a stable, versioned `RoutingKey` (e.g. `reports.created.v1`). Handlers must be idempotent (at-least-once delivery).
- Hot path (hubs, matchmaking) never touches MongoDB synchronously; persist via events.
- Logging: `[LoggerMessage]` source-generated methods, structured properties, never log secrets or PII (emails, IPs, fingerprints).
- Package versions only in `Directory.Packages.props`.
- File-scoped namespaces, primary constructors, `_camelCase` private fields, no dead or commented-out code.

## Testing
- Unit tests: domain logic, handlers, pairing logic, moderation rules, rate limiter.
- Integration tests: real Mongo/Redis/RabbitMQ via Testcontainers, API via `WebApplicationFactory<Program>`.
- All tests must pass before a phase is marked done.

## Docs to keep current
`FEATURES.md`, `docs/features/<feature>.md`, `docs/architecture.md`, `docs/api.md`, `docs/security.md`, `docs/decisions/`, `CHANGELOG.md`.
