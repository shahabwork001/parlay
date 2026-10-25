# API

Machine-readable spec: `GET /openapi.json` (OpenAPI 3.1, generated from zod schemas). Interactive reference: `/scalar`. Both are served only when `NODE_ENV=development`.

## Conventions

- Base path for resources: `/api/v1/...` (none yet in Phase 1).
- JSON, camelCase, ISO 8601 UTC timestamps, UUID v7 ids. Request bodies are limited to 100 kB.
- Every response carries `X-Request-Id` (an incoming well-formed `X-Request-Id` is reused).
- Errors: RFC 7807 `application/problem+json` with `traceId` (equal to the request id), `errorCode` for expected failures, and `errors` (field path to messages) for validation failures.
- Pagination: `?page=1&pageSize=20` (max 100) returning `{ items, page, pageSize, totalCount, totalPages, hasNextPage }`.
- Auth (Phase 2): `Authorization: Bearer <access token>`; refresh token in an httpOnly cookie.

## Error status mapping

| AppError type       | Status                   |
| ------------------- | ------------------------ |
| validation          | 400                      |
| unauthorized        | 401                      |
| forbidden           | 403                      |
| not_found           | 404                      |
| conflict            | 409                      |
| failure             | 422                      |
| rate_limited        | 429                      |
| Malformed JSON body | 400                      |
| Unhandled exception | 500 (no details exposed) |

## Endpoints

| Method | Path            | Auth | Description                                                                     |
| ------ | --------------- | ---- | ------------------------------------------------------------------------------- |
| GET    | `/health/live`  | none | Liveness: `{ "status": "Healthy", "checks": [] }`                               |
| GET    | `/health/ready` | none | Readiness: `{ "status", "checks": [{ "name", "status" }] }`; 503 when unhealthy |

## Socket.IO events

None yet. The gateway arrives in Phase 3.

## Integration events

None yet. Conventions: see [architecture.md](architecture.md#messaging-implemented-in-phase-1).
