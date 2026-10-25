# Parley backend

API, real-time gateway and background workers for **Parley**, an anonymous random video and text chat platform for adults, with strict moderation.

- **API** (`src/api`): Node.js 24, Express 5, TypeScript. Socket.IO for signaling and text chat (from Phase 3).
- **Workers** (`src/workers`): RabbitMQ consumers (moderation pipeline, analytics, cleanup).
- **Infrastructure**: MongoDB, Redis, RabbitMQ, coturn (TURN/STUN), Mailpit (local email).

Project state lives in [FEATURES.md](FEATURES.md). Architecture: [docs/architecture.md](docs/architecture.md).

## Prerequisites

- Node.js 24+ and npm 11+
- Docker Desktop (Compose v2.20+ for `include`; also needed for integration tests)
- Bash (Git Bash on Windows) for the helper scripts

## One-command setup

From the parent folder, `./scripts/dev-up.sh` starts the full stack (backend and frontend).

Backend only, in containers:

```bash
./scripts/init-env.sh                # creates .env with generated secrets (adds missing keys later)
docker compose up -d --build --wait
curl http://localhost:8080/health/ready
./scripts/seed.sh                    # creates the first SuperAdmin and prints its password once
```

The seeded SuperAdmin (`SEED_ADMIN_EMAIL`, default `admin@parley.local`) must enrol two-factor authentication on the account page before staff permissions apply. Emails (confirmation, password reset) appear in Mailpit at http://localhost:8025.

Run the API and workers on your machine against containerised infrastructure:

```bash
docker compose up -d mongodb redis rabbitmq coturn mailpit
npm ci
cat > .env.local <<EOF
NODE_ENV=development
LOG_LEVEL=debug
MONGO_URI=mongodb://parley:<MONGO_ROOT_PASSWORD>@localhost:27017/?authSource=admin
REDIS_URL=redis://:<REDIS_PASSWORD>@localhost:6379
RABBITMQ_URL=amqp://parley:<RABBITMQ_PASSWORD>@localhost:5672
CORS_ALLOWED_ORIGINS=http://localhost:3000
JWT_SECRET=<JWT_SECRET>
HASH_SECRET=<HASH_SECRET>
TOTP_ENCRYPTION_KEY=<TOTP_ENCRYPTION_KEY>
SMTP_HOST=localhost
EOF
npm run dev:api        # http://localhost:8080, API reference at /scalar
npm run dev:workers    # http://localhost:8081
```

Passwords and secrets come from your `.env`. `.env.local` is git-ignored.

## Local endpoints

| Service                                  | URL                                                  |
| ---------------------------------------- | ---------------------------------------------------- |
| API                                      | http://localhost:8080                                |
| API reference (Scalar, development only) | http://localhost:8080/scalar (spec: `/openapi.json`) |
| Health (liveness / readiness)            | http://localhost:8080/health/live, /health/ready     |
| Workers health                           | http://localhost:8081/health/ready                   |
| RabbitMQ management                      | http://localhost:15672                               |
| Mailpit                                  | http://localhost:8025                                |
| TURN/STUN                                | `turn:localhost:3478` (UDP/TCP)                      |

## Environment variables

Compose-level variables (`.env`, see `.env.example`):

| Variable                                                       | Purpose                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                     | `production` in containers; `development` enables Scalar and pretty logs (local `npm run dev:*` only, since pino-pretty is a dev dependency) |
| `LOG_LEVEL`                                                    | pino level (`info` by default)                                                                                                               |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `MONGO_DATABASE` | MongoDB credentials and database name                                                                                                        |
| `REDIS_PASSWORD`                                               | Redis `requirepass`                                                                                                                          |
| `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`                       | RabbitMQ credentials                                                                                                                         |
| `TURN_SECRET`, `TURN_REALM`, `TURN_EXTERNAL_IP`                | coturn shared secret (HMAC credentials), realm, advertised relay IP                                                                          |
| `FRONTEND_ORIGIN`                                              | Exact origin allowed by CORS; base for links in emails                                                                                       |
| `JWT_SECRET`, `HASH_SECRET`                                    | Access-token signing secret and keyed-hash pepper (32+ characters)                                                                           |
| `TOTP_ENCRYPTION_KEY`                                          | 32 random bytes in base64; encrypts TOTP secrets at rest                                                                                     |
| `TERMS_VERSION`                                                | Current Terms version; changing it asks everyone to accept again                                                                             |
| `COOKIE_SECURE`                                                | Secure flag on the refresh cookie (keep `true`; browsers accept it on localhost)                                                             |
| `RATE_LIMIT_MULTIPLIER`                                        | Scales all rate limits; 1 in production, 50 in the local `.env`                                                                              |
| `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM`                         | Outgoing email (Mailpit locally)                                                                                                             |
| `SEED_ADMIN_EMAIL`                                             | Email of the seeded SuperAdmin                                                                                                               |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                  | Optional OTLP collector; telemetry disabled when empty                                                                                       |

Application variables (validated at startup by `src/infrastructure/config/config.ts`):

| Variable                                                                            | Default                      | Used by       | Purpose                                                    |
| ----------------------------------------------------------------------------------- | ---------------------------- | ------------- | ---------------------------------------------------------- |
| `PORT`                                                                              | 8080 / 8081                  | api / workers | HTTP port                                                  |
| `MONGO_URI`, `MONGO_DATABASE`                                                       | required / `parley`          | both          | MongoDB connection                                         |
| `REDIS_URL`                                                                         | required                     | both          | Redis connection (`redis://:password@host:port`)           |
| `RABBITMQ_URL`                                                                      | required                     | both          | Broker connection (`amqp://user:pass@host:port`)           |
| `RABBITMQ_PREFETCH`                                                                 | 16                           | workers       | Unacknowledged messages per consumer                       |
| `RABBITMQ_DELIVERY_LIMIT`                                                           | 5                            | workers       | Handler attempts before dead-lettering                     |
| `RABBITMQ_RETRY_DELAY_MS`                                                           | 1000                         | workers       | Base retry backoff (doubles per attempt, max 30 s)         |
| `CORS_ALLOWED_ORIGINS`                                                              | required                     | api           | Comma-separated exact origins                              |
| `FRONTEND_URL`                                                                      | `http://localhost:3000`      | api           | Base URL for links in emails                               |
| `TRUST_PROXY`                                                                       | `loopback`                   | api           | Express trust proxy, so rate limits see the real client IP |
| `JWT_SECRET`, `HASH_SECRET`, `TOTP_ENCRYPTION_KEY`                                  | required                     | api           | Identity secrets                                           |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`                                | 900 / 30                     | api           | Token lifetimes                                            |
| `TERMS_VERSION`, `COOKIE_SECURE`, `RATE_LIMIT_MULTIPLIER`                           | `2026-10-25` / true / 1      | api           | See above                                                  |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | `SMTP_HOST` required         | workers       | Email delivery                                             |
| `SEED_ADMIN_EMAIL`, `SEED_PRINT_CREDENTIALS`                                        | `admin@parley.local` / false | seed          | First SuperAdmin                                           |
| `OTEL_SERVICE_NAME`                                                                 | set in Dockerfile            | both          | Telemetry service name                                     |

## Scripts

| Script                                        | What it does                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev:api` / `npm run dev:workers`     | Watch mode with tsx (loads `.env.local` if present)                       |
| `npm run build`                               | Compile to `dist/`                                                        |
| `npm run start:api` / `npm run start:workers` | Run the compiled output with telemetry preloaded                          |
| `npm run lint` / `npm run lint:fix`           | ESLint (type-aware, layering rules, zero warnings)                        |
| `npm run format` / `npm run format:check`     | Prettier                                                                  |
| `npm run typecheck`                           | `tsc --noEmit`                                                            |
| `npm test`                                    | Unit tests                                                                |
| `npm run test:integration`                    | Integration tests (Docker required)                                       |
| `npm run check`                               | Lint, format check, typecheck and unit tests                              |
| `npm run seed` / `npm run dev:seed`           | Seed the first SuperAdmin (compiled / from source)                        |
| `./scripts/init-env.sh`                       | Create `.env` with random secrets, or add missing keys to an existing one |
| `./scripts/seed.sh`                           | Seed the running Compose stack and print the SuperAdmin password once     |

## Repository layout

```
src/domain           entities, value objects, domain events (no dependencies)
src/application      use cases by feature, ports, schemas
src/infrastructure   Mongo, Redis, RabbitMQ, config, observability, health, external providers
src/api              Express app, routers, middleware, OpenAPI, server entry point
src/workers          RabbitMQ consumers, workers entry point
tests/unit           fast tests (no Docker)
tests/integration    Testcontainers tests
docs/                architecture, API, security, ADRs, feature docs
```
