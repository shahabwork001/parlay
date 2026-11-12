# Current priority: low-cost free MVP (supersedes earlier billing/expansion priorities)

Owner-authorized preview deployment (2026-10-31): deployed to Hetzner at https://parley.178-104-162-246.sslip.io with HTTPS/WSS, closed Adult/payments, registration closed pending SMTP, and MFA-protected admin access. Public text/direct-video and final forced TURN relay checks passed after the owner opened the TURN firewall ports and the deployment's same-server relay mapping was corrected. See DEPLOYMENT_REPORT.md for operations, evidence and remaining gates. This later explicit owner approval supersedes the historical no-deployment instruction below for this preview only; no paid integrations or purchases were authorized.

Latest validation (2026-10-31): Docker responds and all eight original services report healthy. Isolated backend/frontend builds passed, as did frontend lint. Browser rerun passed 79 cases; the remaining case passed after a test-selector-only correction in a targeted rerun. All 80 cases have passing evidence across those runs, including admin contrast, ownership/reconnect, closed Adult access and local forced TURN. Disposable validation resources were cleaned up. See VALIDATION_REPORT.md for exact evidence; the older Docker-blocked status below is historical. Next gates are physical devices/separate networks, deployed HTTPS/WSS and real SMTP, sustained load, off-host backups and operational readiness. No public launch or paid integrations were enabled.

No company, merchant account, paid age provider, hosted database or analytics subscription is assumed. Do not spend money or deploy publicly. Core chat remains free. Preserve billing foundations, but production checkout stays unavailable; public Plus is a proposed $9.99/month preview with opt-in waitlist, never a fake membership. Adult Chat remains unavailable without approved age assurance. Paid integration, broadcasting, uploads, social feeds, wallets and creator payouts are deferred.

Delivery order: (1) report-processing recovery, retry-safe effects and startup indexes; (2) consent and age gating; (3) minimal deployment resources, configuration, backup/restore and real-network validation; (4) first-party product metrics in the existing admin dashboard; (5) private premium waitlist and conversion measurement.

Inspection of work in progress: Phase 1 pools/consent/screening are implemented and tested. Since then, provider-independent billing models, Mongo store/inbox, mock adapter, API and pages, and an age-assurance status foundation have been written but not yet fully verified. Preserve these files; do not treat them as payment approval or enable mock subscriptions for the MVP. Update pricing to waitlist and verify production remains provider-independent.

The following earlier roadmap is retained as history; the priorities above govern execution.

# Parley product transformation

## Architecture and baseline

Two independent repositories: Next.js/React frontend; layered Express/Socket.IO backend with workers. MongoDB persists identity, moderation, blocks and site configuration; Redis owns atomic Lua matchmaking, sessions, presence and caches; RabbitMQ delivers worker jobs; native WebRTC uses coturn fallback. Preserve these boundaries and existing uncommitted work.

## Implementation phases and dependencies

1. **Interaction modes (current implementation):** General by default; isolated Adult pools; per-search explicit consent; server authorization seam; session-derived screening. Adult access fails closed until an age-assurance adapter is installed. Preserve blocks, bans, language, interests and atomic pairing. No inferred consent or automatic General-to-Adult fallback.
2. **Age assurance:** provider selection and jurisdiction decision, verified webhook authentication, durable provider-reference/status/expiry records, audit, start/status API, UI. Store no raw ID documents. Wire the server-only AdultAccessPolicy to verified records. Self-attestation and image heuristics are not verification. No provider is currently approved or implemented; Adult Chat remains unavailable.
3. **Matching UX/lifecycle:** wait timer, tab ownership and reconnect races, cancellation and disconnect tests; real-network TURN and mobile validation.
4. **Social:** opt-in profiles with unique usernames, moderated avatar storage, privacy, accepted connections, durable private messages, retention and authorization. Requires media storage/provider decision before avatars.
5. **Plus:** configurable $9.99 monthly plan, entitlements, durable subscription lifecycle, idempotent signed webhooks, expiry/cancellation, admin views. Checkout stays disabled without an approved processor. Do not fabricate payments.
6. **Reliability:** durable outbox/reconciliation; independently recoverable moderation effects; required indexes before readiness; backups and tested restore; deliberate Socket.IO transport strategy; setup/relay/failure metrics. Complete before public traffic.
7. **UX:** preserve components; responsive dark-first landing, clear modes, session controls, optional accounts and honest Plus availability.
8. **Policy:** align Terms version, consent, evidence retention, account export/deletion operations; obtain jurisdiction-specific decisions. No claim of compliance or provider approval.
9. **Analytics:** aggregate activity, matching percentiles, sessions, RTC failures, retention, paid conversion/churn and cost estimates, without conversation contents.

## Release gates

No public Adult Chat until verified-provider callbacks, revocation/expiry, consent withdrawal, abuse handling, processor/hosting acceptance and jurisdiction obligations are resolved. No payments without approval. No destructive migration. Do not represent this Phase 1 foundation as production readiness.

## Compatibility and rollout

Legacy queue requests and Redis sessions default to General. General Redis queue names are unchanged; Adult adds `adult-` to the existing trust-pool suffix. Drain sessions and deploy API/frontend together: old API instances do not enforce the new interaction contract. Existing General moderation stays enabled. Consent is explicit per Adult search and is not persisted in browser preferences. Next, stop, disconnect or mode change ends that consent; reconnect does not rejoin Adult automatically.

## Verification

Run unit tests, typechecks, lint and builds in both projects; integration tests need Docker/Testcontainers. Exercise pool isolation, consent rejection, unavailable verification, screening policy, report/block and queue cancellation. Existing checks are evidence only when run on this working tree. Phase status and command outcomes are recorded below after verification.

Terms revision: frontend and API defaults are 2026-10-28. Operators must update any existing TERMS_VERSION environment override to 2026-10-28 before deployment; old consent must be reaccepted. The local backend/.env previous default Terms version was aligned; no secrets were changed. Explicit deployment overrides must also be aligned.

## Phase 1 results

Implemented the isolated interaction contract, explicit consent UI, fail-closed eligibility seam, authoritative screening policy, delayed-retry cancellation protection and policy/Terms updates. Backend: 204 unit and 72 integration tests passed. Frontend: 68 unit and 10 browser smoke tests passed against a fresh build. Both builds, typechecks and lint passed; formatting corrections verified. See [Phase 1 report](PHASE_1_REPORT.md) for files, limitations and Phase 2 dependencies.

## Next increment: age-assurance foundation and provider-agnostic billing

Age: durable attempts/status/revision/expiry with audit and provider interface, unavailable provider default, account status UI. Actual provider callbacks, jurisdictions and verification-onboarding approval remain release gates; no mock age verification. Adult remains closed.
Billing: four Mongo collections (plans, subscriptions, payments, processed_webhook_events), durable verified inbox and monotonic snapshot projections; no multi-document transaction dependency. Default Plus price 999 USD minor units monthly, admin-editable for new checkouts. Immutable agreed price per subscription. Saved matching presets are the first server-enforced benefit. Checkout idempotency, provider cancellation intent/retry, verified event lifecycle, lazy expiry plus sweep, owner-only management and MFA/permission-protected admin visibility. Default provider none; mock requires explicit development/test configuration and signed canonical events. No card fields. Production mock confirmation and mock entitlements are forbidden.
Provider integration requires approval, live credentials, allowed hosted-checkout origins, authenticated webhook validation and authoritative monotonic subscription snapshots. Existing clients cannot activate membership by visiting a return URL. Real checkout remains disabled until a live adapter is reviewed and configured. Test concurrency, replay, crash recovery, stale events, failure/refund/expiry, authorization and production mock rejection before release.

## Low-cost MVP increment results

Implemented report recovery and idempotent effects, startup index gate, ban/block rehydration, explicit closed Adult flag, first-party metrics, private Plus waitlist and a validated low-cost Compose overlay. Billing foundations are retained and deferred; no live provider or public checkout is enabled. Verification and remaining launch gates are recorded in [FREE_MVP_REPORT.md](FREE_MVP_REPORT.md). Next: isolated real-device/network/TURN, proxy/SMTP and backup-restore drills plus remaining real-time race and non-report outbox hardening.

## Isolated validation increment (2026-10-29)

Added an isolated Compose/PowerShell harness and a real Mongo archive/restore drill. Browser validation reproduced admin keyboard/contrast issues and a multi-tab socket-ownership bug; fixes and regression coverage are implemented. The local backup/restore passed. A Docker host failure interrupted the final rebuild; the owner approved engine recovery. See [VALIDATION_REPORT.md](VALIDATION_REPORT.md) for exact evidence, recovery and final status. Physical-device/separate-network and deployed HTTPS/WSS remain distinct launch gates.

Validation status: 211 backend unit, 87 integration and 70 frontend unit tests passed. Last full-stack run: 76 passed with one contrast failure and one skipped; contrast code is corrected, but final browser rerun/cleanup is blocked by the Docker host outage even after owner-approved recovery attempts. Resume commands and precise limitations are in VALIDATION_REPORT.md. No launch-ready claim.
