# API usage

The backend's API reference is in `../backend/docs/api.md` (and `/scalar` on a development API). This page lists what the frontend consumes and where.

| Repository             | Method                                                                                                                               | Backend call                                                               | Used by                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------ |
| `SystemRepository`     | `getReadiness()`                                                                                                                     | `GET /health/ready` (503 accepted)                                         | `features/system-status`             |
| `AuthRepository`       | `startAnonymousSession`, `register`, `verifyEmail`, `resendVerification`, `login`, `logout`, `requestPasswordReset`, `resetPassword` | `/api/v1/auth/*`                                                           | terms gate, auth pages, account menu |
| `AccountRepository`    | `getCurrent`, `acceptCurrentTerms`, `startTwoFactorSetup`, `confirmTwoFactorSetup`                                                   | `/api/v1/me*`                                                              | account page, terms gate             |
| `ModerationRepository` | `submitReport`, `getMyBan`, `appeal`                                                                                                 | `POST /api/v1/reports`, `GET /api/v1/me/ban`, `POST /api/v1/me/ban/appeal` | report dialog, /banned               |
| $1                     | (internal)                                                                                                                           | `refreshSession()` in `src/lib/auth`                                       | `POST /api/v1/auth/refresh`          | session bootstrap, 401 retry |

## Real-time

| Module                                     | Purpose                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/services/realtime/chat-connection.ts` | Opens the Socket.IO connection with the in-memory access token; refreshes the session once on `auth.required` |
| `src/services/realtime/chat-events.ts`     | Typed event contract, mirrored from the backend (see backend docs/api.md)                                     |
| `src/features/chat/hooks/use-chat.ts`      | Maps socket events to the chat store and exposes join, next, stop, block, send and typing                     |
| `src/services/webrtc/peer-session.ts`      | One RTCPeerConnection per match: perfect negotiation, ICE restart, track replacement, stats                   |
| `src/services/media/media-devices.ts`      | getUserMedia with remembered devices, error classification, device listing                                    |
| $1                                         | `src/services/safety/content-screener.ts`                                                                     | Samples the own camera into the NSFWJS worker; `createBlurredTrack` for flagged video |
| `src/services/safety/nsfw.worker.ts`       | Web Worker: NSFWJS MobileNetV2 classification of transferred frames                                           |
| `src/services/media/snapshot.ts`           | One JPEG frame of a stream for report evidence                                                                |

## Client conventions

- One shared `HttpClient` (`src/lib/http`), base URL from `NEXT_PUBLIC_API_BASE_URL`, `credentials: "include"` for the refresh cookie, bearer token injected from the in-memory session.
- An authenticated request that gets 401 triggers one refresh and one retry.
- Non-2xx responses throw `ApiError` with parsed ProblemDetails unless the status is listed in `acceptedStatuses`.
- TanStack Query does not retry 4xx errors and retries others at most twice.
