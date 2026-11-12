# Isolated full-stack validation � 29 October 2026

## Current status — 31 October 2026

Later deployment evidence: the owner authorized a Hetzner preview deployment. Public HTTPS/WSS text chat, direct synthetic video, admin password/TOTP sign-in, closed Adult/checkout gates and a final forced TURN relay test passed. See DEPLOYMENT_REPORT.md for the firewall/mapping correction, deployment details and remaining physical-device/operations gates. References below to no public deployment describe the earlier isolated validation increment.

This section supersedes the blocked engine/retest/cleanup status below; the earlier incident record remains historical.

- Docker engine access succeeded. All eight original Parley containers reported healthy before and after validation; no original services were rebuilt or replaced.
- Rebuilt the isolated project `parley-validation-c827a5e19d34` successfully. Backend build and frontend production build/TypeScript passed. Full frontend lint passed; changed badge/test files also passed lint and formatting checks.
- First browser run: 77 passed, 2 failed, 1 blocked by the serial admin audit. The remaining contrast failure was the shared destructive badge on active bans, corrected with dark red text in light mode and light red text in dark mode. The closed-gate regression contained a corrupted button-label separator and then an ambiguous alert selector; corrected its locators and scoped the alert to main content.
- Second full browser run: 79 passed, 1 test-selector failure. The remaining Adult/checkout test then passed in a targeted rerun after the selector-only correction. All 80 cases now have passing evidence across these runs; this is not a claim of one uninterrupted 80/80 run.
- Passing coverage includes authenticated admin accessibility in both themes and at 360 px, live text-chat accessibility, socket ownership, offline reconnect, closed Adult access, absence of public checkout, account/email/2FA flows, moderation, synthetic video and forced local TURN relay. Physical devices and separate networks remain untested.
- Scoped teardown succeeded: removed only this validation project's containers, network, disposable volumes and generated credential file. The prior local backup drill remains historical passing evidence; its disposable restored database was removed with the validation volume. A new validation session requires a fresh RunId; do not reuse the historical resume commands below.
- No public deployment or payments were enabled. Remaining launch gates are the physical-device/separate-network, deployed HTTPS/WSS, real SMTP, load monitoring, off-host backup and abuse-operation requirements below. Existing source changes remain uncommitted.

## Scope and isolation

Built the current workspace into unique `parley-validation-*` Docker images in project `parley-validation-c827a5e19d34`. Generated disposable credentials in ignored `.validation/<run>/validation.env`; no production credentials copied. All published test ports bind 127.0.0.1: frontend 3107, API 18080, Mailpit 18025, TURN 13478 and relay 49300�49320. Dedicated volumes/network; staff fixtures explicitly target this Compose project and env file. Payments and Adult Chat are closed. Local email terminates in Mailpit. Coturn's allow-loopback-peers setting is test-only and must not be copied into production.

## Reproduced and fixed

- Admin scrolling content lacked keyboard focus. Added a labelled focusable region.
- Multi-tab takeover left the previous composer active; an owning socket closing with another idle chat tab could leave the partner connected. Added Redis socket-owner leases, owner-fenced queue insertion/cancellation/session endings, stale candidate rejection, and a replaced-tab notification. Only the owning tab joins the subject chat room. Old disconnects cannot clear replacement work. Explicit report termination also checks the expected session atomically.
- Expanded coverage exposed insufficient contrast on high-severity badges. Updated the foreground in both themes and labelled the interaction-mode button group.

## Browser evidence before final retest

Initial full-stack run: 66 passed, 1 admin keyboard-access failure, 1 skipped. Expanded run after the first fixes: 76 passed, 1 severity-badge contrast failure, 1 skipped; new multi-tab takeover/owner-close test passed. Text messaging, typing, skip, blocking, minor-safety suspension/appeal, staff moderation and maintenance, registration/email confirmation/reset, 2FA, camera preflight, rendered remote frames, forced TURN relay and camera toggle were exercised against real local API/workers/infra. Light/dark and 360px audits include pricing, subscription preview and age-status pages. These are synthetic desktop Chromium cameras and a mobile-sized viewport, not physical mobile hardware or separate-network evidence. Final contrast retest and newly added offline-reconnect/closed-gate checks are recorded below when completed.

## Database backup/restore drill � passed

Stopped only the validation API/workers for a consistent snapshot. mongodump/mongorestore restored 223 test documents into a new database in the isolated Mongo container, without --drop. Content and index digests matched for 11 checked collections, including 7 users, 2 reports, evidence, bans, blocks, trust, audit, site configuration and plans. A browser-fixture Argon2 password verified after restore, and encrypted staff TOTP material decrypted with the original isolated key. The test writers restarted healthy afterward. This proves a local archive round trip; encrypted off-host storage, scheduling and production disaster recovery remain separate launch requirements.

## Recovery incident

During a subsequent image rebuild, Docker's global daemon returned HTTP 500; the existing stack also became unreachable. A frontend test rerun encountered a host memory-allocation failure after 68 passing tests. The owner explicitly approved restarting Docker Desktop. Standard restart stalled. Force-stop/start revealed inaccessible Windows AF_UNIX runtime sockets. Recovery preserved, rather than deleted, the socket-only directories:

- C:/Users/AZHAANTRADERS/AppData/Local/Docker/run.parley-recovery-20261029 (three runtime sockets)
- C:/Users/AZHAANTRADERS/AppData/Local/docker-secrets-engine.parley-recovery-20261029 (engine.sock only)
  No secret contents were read, no factory reset was performed, and no data-volume directory was moved. Validation now uses bounded container memory and sequential backend/frontend builds. Engine recovery, original-service health and final cleanup status are recorded below when confirmed.

## Repeatable commands (PowerShell, repository root)

Choose a new 12-character lowercase hex RunId for each run. Start refuses to overwrite an existing run. Example:

```powershell
$run = [guid]::NewGuid().ToString('N').Substring(0,12)
./scripts/validate-stack.ps1 -Action Start -RunId $run
./scripts/validate-stack.ps1 -Action Test -RunId $run
./scripts/validate-stack.ps1 -Action BackupDrill -RunId $run
./scripts/validate-stack.ps1 -Action Rebuild -RunId $run
./scripts/validate-stack.ps1 -Action Stop -RunId $run
```

Stop removes only the validated, fixed-prefix test project/volumes and its generated credential file. Browser reports remain under frontend/test-results (ignored). BackupDrill refuses to overwrite an existing restore database; use a new run for a repeat drill. CLI commands require Docker access. No public deployment or paid provider is involved.

## Remaining launch gates

Physical desktop/mobile permissions and media; two real networks and restrictive-network relay/ICE recovery; deployed TLS certificate, HTTPS/WSS reverse proxy and secure-cookie configuration; actual SMTP delivery beyond Mailpit; sustained resource/load monitoring; encrypted off-host backups; abuse response; provider/jurisdiction approval before any Adult access or payments. Drain sessions during ownership-contract rollout and update every API/frontend instance together. No production-ready or legal-compliance claim is made.

## Final status for this increment

- Backend: 211 unit tests and 87 integration tests passed, including socket ownership, stale candidate/cleanup fencing and expected-session fencing. Backend lint passed.
- Frontend: final one-worker rerun passed all 70 unit tests after the host restart attempts; final typecheck passed. The earlier 68-pass run with an out-of-memory worker was not treated as a passing suite. Frontend lint passed before the final test-only additions.
- Browser full stack: the last completed expanded run had 76 passes, 1 severity-badge contrast failure, 1 skipped. The multi-tab regression and forced TURN video passed. The contrast fix is implemented but its final browser retest is blocked; two subsequent offline-reconnect/closed-gate tests were added but have not run. Do not report the entire browser suite green.
- The Mongo backup/restore drill passed as described above. No production data was used in that drill.
- Docker recovery remains blocked: after approved Desktop force-stop/start, preservation of socket-only runtime folders and a Docker-only WSL termination/restart, the engine still returns HTTP 500 or times out. Linux init logs show layer-unmount errors. No factory reset, data-volume deletion, WSL unregister, Windows restart or settings reset was performed. Existing-container health/integrity has not been reverified after the engine outage.
- Additional socket-only recovery backups have suffixes `-paired` and `-wsl` alongside the two paths above; every directory move checked its parent path, refused overwrite and rejected any unexpected non-runtime entries. These are IPC artifacts, not container disks or credential stores.
- The validation project has NOT been removed because Docker cannot accept teardown requests. Its ignored credential file remains available so scoped cleanup can run later. Its containers have no automatic restart policy; do not assume they resumed. No command targeted the original Parley stack for build, replacement, test fixtures or teardown. The owner-approved engine restart affects its availability as well.

## Resume once Docker is healthy

Use the existing run ID `c827a5e19d34` to rebuild sequentially with the new memory caps, run the full suite (now 80 tests), and clean up only this project:

```powershell
./scripts/validate-stack.ps1 -Action Rebuild -RunId c827a5e19d34
./scripts/validate-stack.ps1 -Action Test -RunId c827a5e19d34
./scripts/validate-stack.ps1 -Action Stop -RunId c827a5e19d34
```

The backup drill already ran for this ID and intentionally refuses to overwrite its restore database. A fresh drill needs a new run ID. After Docker recovery, also verify the pre-existing Parley services and any other previously running containers before declaring the host recovered. Do not use broad prune, volume deletion or factory reset as test cleanup.
