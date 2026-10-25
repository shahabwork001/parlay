# Parley backend

API, real-time hub and background workers for **Parley**, an anonymous random video and text chat platform for adults, with strict moderation.

- `Parley.Api`: ASP.NET Core minimal APIs, SignalR (signaling and text chat), auth.
- `Parley.Workers`: RabbitMQ consumers (moderation pipeline, analytics, cleanup).
- Infrastructure: MongoDB, Redis, RabbitMQ, coturn (TURN/STUN), Mailpit (local email).

Project state lives in [FEATURES.md](FEATURES.md). Architecture: [docs/architecture.md](docs/architecture.md).

## Prerequisites
- .NET SDK 10.0.100 or newer (`global.json` rolls forward within 10.0)
- Docker Desktop (Compose v2.20+ for `include`)
- Bash (Git Bash on Windows) for the helper scripts

## One-command setup
From the parent folder, `./scripts/dev-up.sh` starts the full stack (backend and frontend).

Backend only:
```bash
./scripts/init-env.sh          # creates .env with generated secrets (never overwrites)
docker compose up -d --build --wait
curl http://localhost:8080/health/ready
```

Run the API from your IDE against containerised infrastructure:
```bash
docker compose up -d mongodb redis rabbitmq coturn mailpit
dotnet user-secrets --project src/Parley.Api set "Mongo:ConnectionString" "mongodb://parley:<MONGO_ROOT_PASSWORD>@localhost:27017/?authSource=admin"
dotnet user-secrets --project src/Parley.Api set "Redis:ConnectionString" "localhost:6379,password=<REDIS_PASSWORD>"
dotnet user-secrets --project src/Parley.Api set "RabbitMq:Host" "localhost"
dotnet user-secrets --project src/Parley.Api set "RabbitMq:Username" "parley"
dotnet user-secrets --project src/Parley.Api set "RabbitMq:Password" "<RABBITMQ_PASSWORD>"
dotnet user-secrets --project src/Parley.Api set "Cors:AllowedOrigins:0" "http://localhost:3000"
dotnet run --project src/Parley.Api
```
Repeat the same secrets for `src/Parley.Workers`. Passwords come from your `.env`.

## Local endpoints
| Service | URL |
| --- | --- |
| API | http://localhost:8080 |
| API reference (Scalar, Development only) | http://localhost:8080/scalar |
| Health (liveness / readiness) | http://localhost:8080/health/live, /health/ready |
| Workers health | http://localhost:8081/health/ready |
| RabbitMQ management | http://localhost:15672 |
| Mailpit | http://localhost:8025 |
| TURN/STUN | `turn:localhost:3478` (UDP/TCP) |

## Environment variables
Compose-level variables (`.env`, see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Development` enables Scalar/OpenAPI and readable console logs |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `MONGO_DATABASE` | MongoDB credentials and database name |
| `REDIS_PASSWORD` | Redis `requirepass` |
| `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` | RabbitMQ credentials |
| `TURN_SECRET`, `TURN_REALM`, `TURN_EXTERNAL_IP` | coturn shared secret (HMAC credentials), realm, advertised relay IP |
| `FRONTEND_ORIGIN` | Exact origin allowed by CORS |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional OTLP collector; export disabled when empty |

Application settings (environment variables use `__` as the separator):

| Setting | Purpose |
| --- | --- |
| `Mongo__ConnectionString`, `Mongo__Database` | MongoDB connection |
| `Redis__ConnectionString` | StackExchange.Redis configuration string |
| `RabbitMq__Host`, `__Port`, `__Username`, `__Password`, `__VirtualHost` | Broker connection |
| `RabbitMq__PrefetchCount`, `RabbitMq__DeliveryLimit` | Consumer prefetch and deliveries before dead-lettering |
| `Cors__AllowedOrigins__0..n` | Allowed frontend origins (API only) |

## Scripts
| Command | What it does |
| --- | --- |
| `dotnet build Parley.slnx` | Build (warnings are errors) |
| `dotnet test tests/Parley.UnitTests` | Unit tests |
| `dotnet test tests/Parley.IntegrationTests` | Integration tests (Docker required) |
| `dotnet format Parley.slnx --verify-no-changes` | Formatting / analyzer check |
| `./scripts/init-env.sh` | Create `.env` with random secrets |

## Repository layout
```
src/Parley.Domain           entities, value objects, domain events (no dependencies)
src/Parley.Application      use cases by feature, ports, validators
src/Parley.Infrastructure   Mongo, Redis, RabbitMQ, observability, external providers
src/Parley.Api              endpoints, hubs, middleware, composition root
src/Parley.Workers          background consumers
tests/                      unit and integration tests
docs/                       architecture, API, security, ADRs, feature docs
```
