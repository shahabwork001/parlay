# Security

Living document; Phase 8 performs the full review.

## Headers (all routes, `next.config.ts`)

| Header                    | Value                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content-Security-Policy   | `default-src 'self'`; scripts and styles `'self' 'unsafe-inline'` (plus `'unsafe-eval'` in dev only); `connect-src` limited to self and the API origin (http and ws); `media-src` allows `blob:`/`mediastream:` for WebRTC; `frame-ancestors 'none'`; `object-src 'none'` |
| X-Frame-Options           | DENY                                                                                                                                                                                                                                                                      |
| X-Content-Type-Options    | nosniff                                                                                                                                                                                                                                                                   |
| Referrer-Policy           | strict-origin-when-cross-origin                                                                                                                                                                                                                                           |
| Permissions-Policy        | camera and microphone for self only; geolocation disabled                                                                                                                                                                                                                 |
| Strict-Transport-Security | two years, includeSubDomains, preload (ignored by browsers over plain HTTP)                                                                                                                                                                                               |

`'unsafe-inline'` for scripts is required by statically prerendered pages without nonces (ADR 0004). Phase 8 re-evaluates nonce-based CSP for dynamic routes.

## OWASP notes (frontend)

| Risk                    | Mitigation                                                            | Status            |
| ----------------------- | --------------------------------------------------------------------- | ----------------- |
| XSS                     | React escaping; no `dangerouslySetInnerHTML` with user data; CSP      | Done              |
| Broken access control   | Admin route guards (UX only; the API enforces permissions)            | Planned (Phase 6) |
| Token theft             | Access token kept in memory only; refresh token in an httpOnly cookie | Done              |
| Open redirect           | Post-login `next` accepts only same-origin relative paths             | Done              |
| Clickjacking            | `frame-ancestors 'none'`, `X-Frame-Options: DENY`                     | Done              |
| Vulnerable dependencies | `npm audit` in CI, lockfile committed                                 | Partial           |

## Privacy

- Relay-only video (Settings) forces `iceTransportPolicy: relay`, so partners never learn the device's IP address.
- Camera and microphone are released when leaving the chat page.
- Content screening runs in the browser; frames never leave the device, only the flag and its score.
- A report sends one still of the partner's video, taken when Report is pressed, and only after the reporter submits the dialog.

- No analytics or third-party scripts.
- Preferences (interests, language) stay in localStorage until a chat starts.
