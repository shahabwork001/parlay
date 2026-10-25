# 0007: In-memory access token with silent refresh

Date: 2026-10-25. Status: Accepted.

## Context

The API issues a 15-minute access token in the response body and a rotating refresh token in an httpOnly cookie (backend ADR 0010). Each refresh rotates the cookie, so concurrent refreshes from several tabs would look like token reuse.

## Decision

- The access token is kept only in a Zustand vanilla store (`src/lib/auth/session-store.ts`), never in localStorage or sessionStorage.
- On load, `SessionBootstrap` restores the session from the cookie. Actions that depend on the session (such as Start chat) wait for that restore.
- `HttpClient` retries an authenticated request once after a 401, using `refreshSession()`.
- `refreshSession()` is single-flight within a tab and serialised across tabs with the Web Locks API (`navigator.locks`), so only one tab rotates the cookie at a time.

## Consequences

A page reload costs one refresh request. XSS cannot read a long-lived credential. Browsers without Web Locks fall back to per-tab single-flight, covered by the server's 5-second reuse grace.
