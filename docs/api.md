# API usage

The backend's API reference is in `../backend/docs/api.md` (and `/scalar` on a development API). This page lists what the frontend consumes and where.

| Repository         | Method           | Backend call                       | Used by                  |
| ------------------ | ---------------- | ---------------------------------- | ------------------------ |
| `SystemRepository` | `getReadiness()` | `GET /health/ready` (503 accepted) | `features/system-status` |

## Client conventions

- One shared `HttpClient` (`src/lib/http`), base URL from `NEXT_PUBLIC_API_BASE_URL`, `credentials: "include"` for the refresh cookie (Phase 2), bearer token injected when present.
- Non-2xx responses throw `ApiError` with parsed ProblemDetails unless the status is listed in `acceptedStatuses`.
- TanStack Query does not retry 4xx errors and retries others at most twice.
