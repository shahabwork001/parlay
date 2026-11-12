# Interaction modes

Phase 1: implementation with fail-closed Adult access (2026-10-28).

General is the default, including legacy clients. Text/video and trust tiers remain separate. Adult uses isolated Redis pools, explicit consent for each search, and a server-only verified-age policy. There is no production verification adapter, no administrative bypass and no environment switch that fabricates verification. Selecting Adult currently returns a clear unavailable/verification-required error. General continues to work anonymously.

The frontend never persists Adult consent. Changing modes leaves the current session. Every Adult Next requires a new consent action; reconnect does not automatically rejoin. Stop, block, reporting and page exit retain the existing session cleanup. Adult matches carry authoritative interaction and screening policy. Only an authenticated Adult session disables nudity screening; minors, coercion, exploitation, threats, harassment, contact protections and reporting remain prohibited/enforced by existing controls. Automated nudity detection is not age or consent detection. The heuristic classifier only ranks reports; it is not verification.

## API contract

`queue:join`: existing mode (text/video), language, interests; optional interaction (general/adult, default general) and adultConsent (boolean, default false). Server checks Adult consent and account age eligibility before queue insertion. `match:found` adds interaction and safety.screenNudity. Redis sessions store interaction, including ended sessions used for reports; legacy records default to General. `match:next` cannot reuse Adult consent; use a new explicitly consented queue join. queue:leave withdraws the search/session.

## Age-provider configuration guide / Phase 2

No provider is configured or implemented. Keep Adult access disabled. Select an eligible provider and target jurisdictions first. Implement authenticated server callbacks, replay protection, durable pending/verified/rejected/expired/revoked status, verification expiry, audit and revocation of waiting/active sessions; persist only necessary provider references, never raw identity documents. Implement AdultAccessPolicy using those current records and wire it in the server composition root. Do not wire a constant-true adapter, self-attestation or a JWT age claim. Add verification initiation/status UI and tests before release. Policy checks on queue retries and session expiry/revocation are Phase 2 release gates.

## Rollout and verification

Drain active sessions and update backend and frontend together; mixed old/new API versions are unsupported. General queue names are unchanged; Adult queues add adult- to the trust suffix. No database migration or new environment variables in Phase 1. Public launch remains blocked on Phase 2 and production hardening. Tests cover admission, vocabulary policy, queue isolation/ended-session mode, API rejection and explicit UI consent. Docker integration and real-network browser results must be reported separately from unit checks.
