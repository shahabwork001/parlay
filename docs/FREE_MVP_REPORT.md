# Free MVP increment � implementation report

## Business scope

The updated low-cost instruction governs development. Core General Chat remains free. Public /pricing and /subscription are Plus previews with explicit opt-in waitlist actions, not checkout. Existing billing foundations are preserved for future work, not represented as an approved or launch-ready payment integration. No provider account, business registration or production payment credentials are required. No public deployment, expenditure, paid-service activation or outbound waitlist message was performed.

## Implemented changes

- Required Mongo indexes are awaited; failures close clients and block startup. API also restores durable partner blocks and warms active bans before listening.
- Reports persist an incomplete workflow marker atomically with the report document. Immediate suspension is attempted before broker publication. Once durable, reports are acknowledged even if asynchronous effects fail; failures are logged and workers reconcile pending effects every 10 seconds. Scoring completion is separate from score calculation, so a crash cannot permanently skip trust/enforcement. Legacy scored reports are not automatically charged again. Evidence/report writes are still separate; orphan evidence can remain until TTL after a failed report insert.
- Stable per-key trust effect IDs prevent duplicate report/session/flag adjustments across retries and partial multi-key failures. Report-derived automatic bans use deterministic IDs and repair existing cache/enforcement/audit effects; ban audit keys are stable. Broader transactional outbox coverage for all non-report workflows remains deferred.
- WebSocket-only transport is deliberate in both server and browser. Existing Redis atomic pairing remains. Real mobile/separate-network and multi-instance/tab validation remain open.
- Explicit ADULT_CHAT_ENABLED=false release gate plus unavailable age provider. Added Mongo age-status/attempt/expiry/revision foundation, provider interface and account status page; no raw ID documents or fake age verification. Approved provider callbacks/revocation and jurisdiction decisions are not implemented or claimed.
- First-party metrics: registered accounts, UTC daily activity/returns, match attempts/success, average wait and latest-2000 sampled p95, ended-session duration and client-reported RTC setup failure rate. Existing concurrent-user counts remain. No conversation content in analytics. Aggregates and sampling limits are labelled on the existing admin dashboard.
- Private Mongo premium waitlist with verified-email account authorization, explicit consent, idempotent signup, 90-day expiry and immediate opt-out; stores account reference/time/consent version, not duplicated emails/cards. Admin sees counts and authenticated-preview conversion, not a public signup list.
- Optional resource/log-limited production Compose overlay, no Mailpit by default there, non-management RabbitMQ image. Operating guide includes bandwidth math, relay/email/storage/host costs without invented prices, proxy/SMTP configuration, backup/restore procedure and launch evidence checklist.

## Retained billing foundation (deferred)

Plans, subscriptions, payments and verified webhook inbox collections; provider interface; default 999 USD minor-unit monthly plan; ownership/entitlement checks; signed mock test adapter; monotonic webhook projections and reconciliation; cancellation/expiry/failure/refund state; admin record visibility. Actual API composition enables mock only for isolated test environment; production rejects mock configuration and mock entitlements. Public membership routes use the waitlist. No card forms or raw provider bodies are persisted. A real adapter and production approval/credentials are absent. Do not promote this foundation to real payments without another review of provider ordering, retries, cancellation backlog and deployment controls.

## Important files

- Workspace: PRODUCT_ROADMAP.md, LOW_COST_LAUNCH.md, this report, ../docker-compose.production.yml.
- Backend recovery: application/features/moderation/{reports,scoring,ports,bans,trust-handlers,evidence-access}.ts; infrastructure/moderation/{mongo-report-repository,mongo-ban-repository,trust-store}.ts; infrastructure/infrastructure.ts; persistence/mongo/block-repository.ts; workers/{main,consumers}.ts; API composition and socket server.
- MVP insight/waitlist: infrastructure/admin/mvp-insights.ts, application/features/chat/product-metrics.ts, api/features/site/mvp-router.ts, frontend repositories/mvp-repository.ts, features/billing/components/plus-preview.tsx, features/admin/components/product-insights.tsx, features/site/components/activity-tracker.tsx.
- Retained foundations: backend domain/application/infrastructure/API billing modules; application/features/identity/age-assurance.ts; infrastructure/identity/mongo-age-verification.ts; API age router; frontend billing/age repositories and pages.
- Documentation: both FEATURES.md and docs/features/free-mvp.md, backend docs/architecture.md and .env.example. Existing unrelated working-tree changes were preserved; no mixed commit was made.

## Verification

211 backend unit tests, 85 Docker/Testcontainers backend integration tests, 70 frontend unit tests (one worker rerun), and 11 Playwright browser tests against a fresh local production build passed. Includes injected broker/trust failures, retry markers, concurrent trust deduplication, index drift/TTL, signed event replay/inbox recovery, free-account authorization, age-provider unavailability, waitlist consent/privacy/expiry/removal, and browser waitlist flow. Both production builds, typechecks, lint and formatting checks passed; final targeted checks rerun after report acknowledgement changes. Compose production overlay validates without starting services. One concurrent frontend run timed out in an existing test; the full one-worker rerun passed without relaxing assertions.

## Remaining launch blockers and next increment

Do not declare public-launch readiness. Validate real desktop/mobile devices on separate networks, forced TURN and ICE recovery, multi-tab/multi-instance ownership races, WSS/proxy/cookies, SMTP delivery, backup restore and cache-loss recovery, log/alert operation and abuse-response staffing. No compliant age-provider setup or payment approval exists; corresponding features stay closed. Monitor trust effect-document growth and reconcile historical replay boundaries before scaling. Broader non-report outbox coverage and staged operational drills are next. Analytics are sampled/self-reported/pseudonymous, not audited commercial conversion or network telemetry. No revenue outcome is guaranteed.
