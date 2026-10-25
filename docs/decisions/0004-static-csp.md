# 0004: Static CSP with inline scripts allowed

Date: 2026-10-25. Status: Accepted (revisit in Phase 8).

## Context

Nonce-based CSP forces every page to render dynamically, which removes static prerendering of the landing page. Next.js and next-themes rely on inline bootstrap scripts.

## Decision

Send a static CSP from `next.config.ts` with `script-src 'self' 'unsafe-inline'`, everything else locked down: `connect-src` limited to the API origin, `frame-ancestors 'none'`, `object-src 'none'`.

## Consequences

XSS mitigation relies mainly on React escaping and never rendering user HTML. Phase 8 evaluates nonce-based CSP for authenticated and admin routes, which are dynamic anyway.
