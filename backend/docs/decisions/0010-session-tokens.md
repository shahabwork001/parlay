# 0010: Short-lived JWT access tokens and rotating refresh cookies

Status: Accepted (2026-10-25, written down 2026-10-28)

## Context

Every chat starts with an identity, account or not, and the same identity must work for HTTP and for the Socket.IO handshake. Bans must apply to anonymous people too, so even account-less sessions are bound to a device. Tokens in `localStorage` are readable by any injected script; long-lived bearer tokens cannot be revoked quickly.

## Decision

- **Access tokens**: HS256 JWTs (`jose`) valid for 15 minutes, carrying the principal (kind, subject, device, roles, MFA flag, accepted Terms version). Sent as `Authorization: Bearer` and as the Socket.IO `auth.token`. Kept in memory only on the client.
- **Refresh tokens**: opaque random tokens stored as SHA-256 hashes in MongoDB with a TTL index, delivered as the `parley_refresh` cookie (`httpOnly`, `Secure`, `SameSite=Strict`, path `/api/v1/auth`). Every refresh rotates the token within its family.
- **Reuse detection**: presenting an already-rotated token revokes the whole family (it was stolen), except within a 5-second grace window that absorbs parallel refreshes from several tabs.
- **Anonymous sessions** use the same machinery with the device as the subject; the device is found by a keyed hash of the client fingerprint.
- Staff permissions additionally require a session that passed TOTP (`mfa: true`).

## Consequences

- A stolen access token is useful for at most 15 minutes; refresh tokens are unreachable from scripts.
- Role and ban changes reach a session within one access-token lifetime at most; bans are also checked on every socket connect and queue join, so they take effect immediately for chat.
- The API needs no session store for authorisation; the refresh store is the only server-side session state.
- The client must refresh silently (single-flight, coordinated across tabs with Web Locks), which the frontend's session store implements.
