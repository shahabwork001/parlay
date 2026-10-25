# Security

Living document. Phase 8 performs the full review; every phase adds its mitigations here.

## OWASP Top 10 (2021) mitigations
| Risk | Mitigation | Status |
| --- | --- | --- |
| A01 Broken access control | Permission-based policies on every endpoint and hub method; staff 2FA | Planned (Phase 2) |
| A02 Cryptographic failures | Identity PBKDF2 password hashing; HMAC TURN credentials; HSTS outside Development; secrets only from environment | Partial (HSTS, secrets) |
| A03 Injection | MongoDB typed builders only (no string-built queries); FluentValidation on all inputs | Partial (typed builders) |
| A04 Insecure design | Threat model per feature; rate limits; trust score; shadow bans | Planned (Phase 5) |
| A05 Security misconfiguration | Strict CSP (`default-src 'none'` for the API), `nosniff`, `X-Frame-Options: DENY`, CORS locked to exact frontend origins, Scalar/OpenAPI only in Development, non-root containers, infra ports bound to 127.0.0.1 | Done (Phase 1) |
| A06 Vulnerable components | Central package management; CI restore with vulnerability audit | Partial |
| A07 Identification and authentication failures | Short-lived JWT, rotating refresh tokens with reuse detection, lockout | Planned (Phase 2) |
| A08 Software and data integrity failures | Signed anonymous tokens; verified, idempotent payment webhooks | Planned (Phases 2, 7) |
| A09 Logging and monitoring failures | Serilog structured logs, OpenTelemetry traces/metrics, immutable audit log | Partial (logging, telemetry) |
| A10 SSRF | No user-controlled outbound requests; coturn denies multicast peers (private-range peer denial in production config) | Partial |

## Privacy
- Users' IP addresses are never returned to other users; TURN relay-only mode hides them from peers (Phase 4).
- Video and full chat logs are never stored; only report evidence, with retention TTLs (Phase 5).
- Logs must not contain secrets, emails, IPs or fingerprints.
