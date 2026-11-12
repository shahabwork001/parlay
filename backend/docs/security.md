# Security

Reviewed in Phase 8 (2026-10-28) against the OWASP Top 10 (2021). Update this page with every change that affects security.

## OWASP Top 10 (2021) mitigations

| Risk                                           | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                    | Status |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A01 Broken access control                      | Every admin route declares one permission and needs a two-factor session (`requirePermission`); minor-safety decisions and evidence also need `moderation.escalate`, checked in the use case; every socket event checks the caller's own session and partner, never ids from the client; reports are only accepted from participants of the session; staff cannot change their own roles and the last SuperAdmin is protected | Done   |
| A02 Cryptographic failures                     | Argon2id passwords; HMAC-SHA256 with a server secret for device fingerprints, network addresses and recovery codes; SHA-256 for random tokens at rest; AES-256-GCM for TOTP secrets; HS256 JWTs with 32+ character secrets and issuer/audience checks; TURN credentials HMAC-SHA1 per coturn's REST scheme, one hour; HSTS; secrets only from the environment, validated at startup                                           | Done   |
| A03 Injection                                  | zod validation on every HTTP body, query and parameter and every socket payload; Mongo queries built from typed values only (no request objects, which blocks operator injection); user search input is regex-escaped; email templates escape every value; chat text is rendered as text by the client                                                                                                                        | Done   |
| A04 Insecure design                            | Threat notes per feature (below); rate limits per IP, account and device; trust score and pools; automatic bans never target shared networks; report window limited to 10 minutes and to participants; minor-safety workflow with restricted, audit-logged evidence                                                                                                                                                           | Done   |
| A05 Security misconfiguration                  | Helmet: CSP `default-src 'none'`, `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, CORP same-site; `x-powered-by` off; CORS (HTTP and Socket.IO) locked to exact frontend origins; Scalar/OpenAPI only in development; 100 kB JSON limit, 64 kB socket frames; non-root containers; infrastructure ports bound to 127.0.0.1; admin responses no-store                                                                       | Done   |
| A06 Vulnerable and outdated components         | Lockfiles committed; `npm audit --omit=dev` clean in both repos (2026-10-28); CI installs with `npm ci`; build-only tools kept in devDependencies                                                                                                                                                                                                                                                                             | Done   |
| A07 Identification and authentication failures | 15-minute access tokens; rotating refresh tokens (httpOnly, Secure, SameSite=Strict, path-scoped) with reuse detection; lockout after 5 failures for 15 minutes; timing equalisation; no account enumeration; per-IP limits; password reset, 2FA enrolment and role changes sign out other sessions; mandatory TOTP for staff                                                                                                 | Done   |
| A08 Software and data integrity failures       | Signed tokens; integration events schema-validated on publish and consume, with idempotent handlers (scoring once per report, audit entries keyed by event id); no payment webhooks while monetisation is deferred (ADR 0015)                                                                                                                                                                                                 | Done   |
| A09 Security logging and monitoring failures   | pino structured logs; request logs carry only id, method, URL and status (no bodies, IPs or tokens); OpenTelemetry traces and metrics; insert-only audit log of every staff action, automatic ban and evidence view; dead-letter queues visible in the admin system view                                                                                                                                                      | Done   |
| A10 Server-side request forgery                | No user-controlled outbound requests; health checks call configured hosts only; the client never supplies URLs the server fetches                                                                                                                                                                                                                                                                                             | Done   |

### Residual risks and accepted trade-offs

- An open socket stays authenticated after its 15-minute access token expires. Bans disconnect sockets directly (room-based enforcement), and sockets grant no staff powers beyond connecting during maintenance, so this is accepted.
- The frontend CSP allows inline scripts (Next.js without nonces, frontend ADR 0004); there is no user-generated HTML anywhere, and React escapes all text.
- Client-side screening can be disabled by a determined user; reports, trust and bans cover deliberate abuse (ADR 0012, frontend ADR 0008).
- IP and subnet bans can affect other people on a shared network; only staff can issue them, and automatic bans never do.

## Identity threat notes

| Threat                             | Mitigation                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Stolen refresh token               | Single use; replay more than 5 s after use revokes the whole family; the cookie is httpOnly and scoped to `/api/v1/auth` |
| XSS stealing tokens                | Access token only in browser memory; refresh token unreachable from JavaScript                                           |
| CSRF on refresh or logout          | SameSite=Strict cookie; JSON requests from other origins need a CORS preflight that fails                                |
| Credential stuffing                | Per-IP limits, per-account lockout, Argon2id cost                                                                        |
| Account enumeration                | Identical responses for register and forgot-password; unknown emails cost a password verification                        |
| Open redirect after sign-in        | The frontend honours only same-origin relative `next` paths                                                              |
| Redis outage disabling rate limits | The limiter fails open by design (availability); account lockout still applies                                           |

`RATE_LIMIT_MULTIPLIER` must be 1 in production. The local `.env` uses 50 so repeated end-to-end runs from one IP are not throttled.

## Privacy

- Users' IP addresses are never returned to other users or written to logs. Direct WebRTC connections can reveal a device's IP to the peer, so the relay-only setting routes all media through coturn instead.
- TURN credentials are per participant and expire after one hour; the shared secret never leaves the server.
- IP and subnet bans use keyed hashes (`HASH_SECRET`) of the address and its /24 or /64; raw addresses are never stored. Automatic bans never target networks.
- Report evidence is restricted to staff with `reports.review` on a 2FA session (minor-safety evidence additionally `moderation.escalate`); every view is written to `audit_log` before the evidence is returned. Evidence expires by TTL index.
- Snapshots are validated as JPEG (magic bytes) and capped at 96 000 characters of base64; JPEG decoding in the classifier is capped at one megapixel.
- Chat text is moderated server-side (slurs rejected, contact details removed); the client never decides what is delivered.
- Every admin route requires a permission and a two-factor session; minor-safety decisions and evidence also need `moderation.escalate`. Admin responses are mapped field by field, so password hashes, TOTP secrets and network hashes never leave the server.
- Staff role changes revoke all of the person's refresh tokens. The last SuperAdmin cannot be demoted and nobody can change their own roles.
- Every staff action and every evidence view is written to the insert-only audit log.
- Device fingerprints and client IPs are stored only as keyed hashes.
- Video and full chat logs are never stored; only report evidence, with retention TTLs (Phase 5).
- Logs must not contain secrets, emails, IPs, fingerprints or request headers (enforced by serializers and redaction; covered by a unit test).
