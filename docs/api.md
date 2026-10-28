# API

Machine-readable spec: `GET /openapi.json` (OpenAPI 3.1, generated from zod schemas). Interactive reference: `/scalar`. Both are served only when `NODE_ENV=development`.

## Conventions

- Base path for resources: `/api/v1/...`.
- JSON, camelCase, ISO 8601 UTC timestamps, UUID v7 ids. Request bodies are limited to 100 kB.
- Every response carries `X-Request-Id` (an incoming well-formed `X-Request-Id` is reused).
- Errors: RFC 7807 `application/problem+json` with `traceId` (equal to the request id), `errorCode` for expected failures, and `errors` (field path to messages) for validation failures.
- Pagination: `?page=1&pageSize=20` (max 100) returning `{ items, page, pageSize, totalCount, totalPages, hasNextPage }`.
- Auth: `Authorization: Bearer <access token>` (15-minute JWT). The refresh token travels only in the `parley_refresh` cookie (httpOnly, Secure, SameSite=Strict, path `/api/v1/auth`).
- Rate-limited endpoints return `RateLimit-Limit`, `RateLimit-Remaining` and, on 429, `Retry-After`.

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

| Method | Path                                             | Auth                           | Limit (per IP) | Description                                                                                                                                 |
| ------ | ------------------------------------------------ | ------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health/live`                                   | none                           |                | Liveness                                                                                                                                    |
| GET    | `/health/ready`                                  | none                           |                | Readiness; 503 when a dependency is unhealthy                                                                                               |
| GET    | `/api/v1/legal/terms`                            | none                           |                | Current Terms version                                                                                                                       |
| POST   | `/api/v1/auth/anonymous`                         | none                           | 30/h           | Start an anonymous device session. Body: `deviceFingerprint`, `ageConfirmed: true`, `termsVersion`                                          |
| POST   | `/api/v1/auth/register`                          | none                           | 5/h            | Register; always 202. Body: `email`, `password`, `ageConfirmed`, `termsVersion`                                                             |
| POST   | `/api/v1/auth/verify-email`                      | none                           | 20/h           | Confirm email with the token from the link                                                                                                  |
| POST   | `/api/v1/auth/resend-verification`               | bearer                         | 5/h            | Send the confirmation email again                                                                                                           |
| POST   | `/api/v1/auth/login`                             | none                           | 10/min         | Sign in. Body: `email`, `password`, `deviceFingerprint`, optional `totpCode` or `recoveryCode`                                              |
| POST   | `/api/v1/auth/refresh`                           | cookie                         | 60/min         | Rotate the refresh cookie, new access token                                                                                                 |
| POST   | `/api/v1/auth/logout`                            | cookie                         |                | Revoke the session family, clear the cookie                                                                                                 |
| POST   | `/api/v1/auth/password/forgot`                   | none                           | 5/h            | Email a reset link; always 202                                                                                                              |
| POST   | `/api/v1/auth/password/reset`                    | none                           | 10/h           | Set a new password; signs out everywhere                                                                                                    |
| GET    | `/api/v1/me`                                     | bearer                         |                | Account or anonymous session details, roles, permissions                                                                                    |
| GET    | `/api/v1/rtc/ice-servers`                        | bearer                         |                | STUN and TURN servers; TURN credentials expire after `ttlSeconds` (coturn REST scheme)                                                      |
| POST   | `/api/v1/me/terms`                               | bearer                         |                | Accept the current Terms; returns a new access token                                                                                        |
| POST   | `/api/v1/me/two-factor/setup`                    | bearer                         |                | Start TOTP enrolment (secret + otpauth URI)                                                                                                 |
| $1     | POST                                             | `/api/v1/reports`              | bearer         | 30/h per IP, 10/h per account and device                                                                                                    | Report the partner of a live chat or one that ended within 10 minutes. Body: `sessionId`, `category`, optional `note` (500), optional `snapshot` (JPEG data URL, 96 000 chars). 201 `{ id }` |
| GET    | `/api/v1/me/ban`                                 | bearer                         |                | `{ ban: { id, reason, message, startedAt, expiresAt, appealable, appeal } \| null }` for the account, device or network (never shadow bans) |
| POST   | `/api/v1/me/ban/appeal`                          | bearer                         | 5/h            | Appeal the active ban once. Body: `message` (20 to 2000). 201 `{ ban }`                                                                     |
| GET    | `/api/v1/moderation/reports/{reportId}/evidence` | bearer, `reports.review` + 2FA |                | Snapshot (data URL) and messages; audit-logged; minor-safety evidence needs `moderation.escalate`                                           |

Session responses: `{ accessToken, accessTokenExpiresAt, principal: { kind, roles, emailVerified, mfa, termsVersion } }`.

### Identity error codes

| errorCode                              | Status | Meaning                                               |
| -------------------------------------- | ------ | ----------------------------------------------------- |
| `terms.outdated`                       | 400    | The submitted Terms version is not current            |
| `auth.invalid_credentials`             | 401    | Email or password wrong (same for unknown emails)     |
| `auth.two_factor_required`             | 401    | Resend with `totpCode` or `recoveryCode`              |
| `auth.invalid_two_factor`              | 401    | Wrong code (counts as a failed attempt)               |
| `auth.email_not_verified`              | 403    | Confirm the email first                               |
| `auth.locked`                          | 429    | Too many failed attempts; locked for 15 minutes       |
| `auth.session_expired`                 | 401    | Refresh token missing, expired, reused or revoked     |
| `auth.invalid_token`                   | 400    | Email link invalid, expired or already used           |
| `auth.required`                        | 401    | Bearer token missing or invalid                       |
| `auth.forbidden` / `auth.mfa_required` | 403    | Missing permission / staff session without two-factor |
| `rate_limited`                         | 429    | Per-IP limit exceeded                                 |

## Socket.IO events

Connect to the API origin with `socket.io-client` and `auth: { token: <access token> }`. The handshake is rejected with `connect_error` `auth.required` (missing or invalid token), `terms.outdated` (the accepted Terms version is not current) or `moderation.banned` (an active full ban on the account, device, IP or subnet). Every client event with a callback receives `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

| Direction        | Event               | Payload                                                                                                                                | Ack data / notes                                                                                 |
| ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| client to server | `queue:join`        | `{ mode: text or video, language: any or ISO 639-1, interests: string[] (max 10) }`                                                    | `{ status: matched or queued }`; ends any current chat first                                     |
| client to server | `match:next`        | none                                                                                                                                   | `{ status }`; ends the chat (partner reason `skipped`) and searches again                        |
| client to server | `queue:leave`       | none                                                                                                                                   | `null`; ends the chat (partner reason `left`) and leaves the queue                               |
| client to server | `match:block`       | none                                                                                                                                   | `null`; ends the chat (partner sees `left`) and blocks the partner account and device            |
| client to server | `chat:message`      | `{ text }` (max 1000 after trimming)                                                                                                   | `{ id, text, sentAt }` with the cleaned text                                                     |
| client to server | `chat:typing`       | `{ typing: boolean }`                                                                                                                  | no ack                                                                                           |
| server to client | `match:found`       | `{ sessionId, mode, role: caller or callee, sharedInterests, safety: { nsfwThreshold } }`                                              | the caller creates the WebRTC offer; the threshold is stricter in low-trust and shadow pools     |
| server to client | `match:ended`       | `{ sessionId, reason: skipped, left or disconnected }`                                                                                 |                                                                                                  |
| server to client | `chat:message`      | `{ id, text, sentAt }`                                                                                                                 |                                                                                                  |
| client to server | `rtc:signal`        | `{ description: { type: offer, answer or rollback, sdp } }` or `{ candidate: { candidate, sdpMid, sdpMLineIndex, usernameFragment } }` | no ack; relayed to the partner only in video sessions (SDP up to 32 KB; 60 burst, 20 per second) |
| client to server | `media:state`       | `{ audio, video }`                                                                                                                     | no ack; relayed to the partner                                                                   |
| server to client | `chat:typing`       | `{ typing }`                                                                                                                           |                                                                                                  |
| server to client | `rtc:signal`        | as sent by the partner                                                                                                                 | apply with perfect negotiation (callee is polite)                                                |
| $1               | client to server    | `moderation:flag`                                                                                                                      | `{ source: nsfw-screening, score: 0..1 }`                                                        | `{ outcome: recorded or banned }`; 3 flags in 10 minutes ban for 24 hours |
| server to client | `moderation:banned` | `{}`                                                                                                                                   | sent right before a banned person is disconnected; open `/banned`                                |

Ack error codes: `validation`, `chat.no_partner`, `chat.message_blocked` (slurs, or profanity in low-trust pools), `chat.spam` (the same message a 4th time within 30 s), `rate_limited` (30 searches per minute, 5 messages per second, per account, device and network), `moderation.banned`, `internal`. The TypeScript contract lives in `src/api/realtime/chat-events.ts` and is mirrored in the frontend at `src/services/realtime/chat-events.ts`.

## Integration events

| Routing key                        | Publisher                        | Consumer                | Payload                                                                                      |
| ---------------------------------- | -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `notifications.email-requested.v1` | API (identity)                   | workers `notifications` | `{ to, template: verify-email, account-exists or password-reset, link? }`                    |
| $1                                 | `moderation.report-submitted.v1` | API (reports)           | workers `moderation` (`ScoreReport`)                                                         | `{ reportId }` |
| `moderation.content-flagged.v1`    | API (gateway)                    | workers `trust`         | `{ subjectId, deviceId, kind, source: nsfw-screening or blocked-message, score, flaggedAt }` |
| `moderation.ban-issued.v1`         | API or workers (`BanService`)    | workers `audit`         | `{ banId, mode, reason, source, createdBy, reportId, targetKinds, expiresAt, issuedAt }`     |
| `chat.session-ended.v1`            | API (gateway)                    | workers `trust`         | `{ sessionId, mode, startedAt, endedAt, participants: [{ subjectId, deviceId, kind }] }`     |

Conventions: see [architecture.md](architecture.md#messaging-implemented-in-phase-1).
