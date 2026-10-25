# API

Machine-readable spec: `GET /openapi/v1.json`. Interactive reference: `/scalar` (Development only).

## Conventions
- Base path for resources: `/api/v1/...` (none yet in Phase 1).
- JSON, camelCase, ISO 8601 UTC timestamps, Guid v7 ids.
- Errors: RFC 7807 `application/problem+json` with `traceId`, and `errorCode` for expected failures.
- Pagination: `?page=1&pageSize=20` (max 100) returning `{ items, page, pageSize, totalCount, totalPages, hasNextPage }`.
- Auth (Phase 2): `Authorization: Bearer <access token>`; refresh token in an httpOnly cookie.

## Error status mapping
| ErrorType | Status |
| --- | --- |
| Validation | 400 |
| Unauthorized | 401 |
| Forbidden | 403 |
| NotFound | 404 |
| Conflict | 409 |
| Failure | 422 |
| RateLimited | 429 |
| Unhandled exception | 500 (no details exposed) |

## Endpoints
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health/live` | none | Liveness: `{ "status": "Healthy", "checks": [] }` |
| GET | `/health/ready` | none | Readiness: `{ "status", "checks": [{ "name", "status" }] }`, 503 when unhealthy |

## Hub methods
None yet. `ChatHub` arrives in Phase 3.

## Integration events
None yet. Conventions: see [architecture.md](architecture.md#messaging-implemented-in-phase-1).
