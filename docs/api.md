# API usage

The backend's API reference is in `../backend/docs/api.md` (and `/scalar` on a development API). This page lists what the frontend consumes and where.

| Repository          | Method                                                                                                                               | Backend call                       | Used by                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------ |
| `SystemRepository`  | `getReadiness()`                                                                                                                     | `GET /health/ready` (503 accepted) | `features/system-status`             |
| `AuthRepository`    | `startAnonymousSession`, `register`, `verifyEmail`, `resendVerification`, `login`, `logout`, `requestPasswordReset`, `resetPassword` | `/api/v1/auth/*`                   | terms gate, auth pages, account menu |
| `AccountRepository` | `getCurrent`, `acceptCurrentTerms`, `startTwoFactorSetup`, `confirmTwoFactorSetup`                                                   | `/api/v1/me*`                      | account page, terms gate             |
| (internal)          | `refreshSession()` in `src/lib/auth`                                                                                                 | `POST /api/v1/auth/refresh`        | session bootstrap, 401 retry         |

## Client conventions

- One shared `HttpClient` (`src/lib/http`), base URL from `NEXT_PUBLIC_API_BASE_URL`, `credentials: "include"` for the refresh cookie, bearer token injected from the in-memory session.
- An authenticated request that gets 401 triggers one refresh and one retry.
- Non-2xx responses throw `ApiError` with parsed ProblemDetails unless the status is listed in `acceptedStatuses`.
- TanStack Query does not retry 4xx errors and retries others at most twice.
