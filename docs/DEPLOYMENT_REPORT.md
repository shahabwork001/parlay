# Hetzner preview deployment — 31 October 2026

## Admin viewport fit

The admin layout now uses a fixed viewport frame with an unshrinking header and bounded inner scroll regions. The content and desktop navigation extend to the bottom edge while content scrolls independently, avoiding dependence on parent flex sizing. Lint, TypeScript and the production frontend build passed. Deployed dashboard and report queue passed geometry/overflow and WCAG-tagged axe checks at 1880×900, 1253×478 and 360×740. The scrolled short-window dashboard screenshot was visually inspected. An initial diagnostic accessibility check required correcting its browser-context setup; all six route/size combinations then passed. Previous frontend image: `parley-frontend:before-admin-fit-20261031`; original component sources archived on the server. Backend and existing hosted services were not replaced.

## Video view and device controls

Deployed a frontend-only update with a Video settings dialog for automatic/focus/equal-tile layouts, fit/fill, preview corner/size/visibility, local mirroring, live device selection, supported full-screen entry/exit and Reset view. Hiding self-view does not disable capture or screening. Device-switch errors are handled without an unhandled rejection; hardware-specific device switching remains to be checked on real phones. Call-view settings do not alter the transmitted stream. Primary icon controls use 44px targets. Closing settings with Escape does not skip the current partner.

Lint, TypeScript and production builds passed. TURN relay passed on the preceding controls build; the final change corrected native select labels. The final deployed phone run passed both the view-control interaction test (including accessibility audit, uninterrupted remote playback, hiding, mirroring, reset, and supported full-screen toggle) and the existing phone sizing/expand regression. The initial settings selector test stalled on wrapped labels; explicit label/control associations corrected that failure. The previous frontend image is retained as `parley-frontend:before-video-controls-20261031` and original component sources are archived on the server. Changes remain uncommitted.

## Mobile video update

The frontend was rebuilt and replaced after retaining the prior image as `parley-frontend:before-mobile-layout-20261031` and archiving the three original component sources on the server. Backend services were left running. Phone calls now use a large main video and inset self-preview with an accessible enlarge/swap button; desktop remains side by side. Video uses full-frame `object-contain` instead of cropping, and phone preflight has a taller preview. Frontend lint/TypeScript and the production build passed. Three focused deployed browser tests passed: camera preflight, forced TURN relay, and a 390×844 call checking full-frame fit, main/inset size, view swapping, continued remote playback, visible toolbar and no horizontal overflow. The successful phone screenshot was visually inspected. Physical-phone confirmation remains with the owner.

## Current deployment

- Site: https://parley.178-104-162-246.sslip.io
- Admin: https://parley.178-104-162-246.sslip.io/admin
- Host: `178.104.162.246`, SSH user `shahab`.
- Directory: `/home/shahab/apps/parley-preview`; Compose project `parley-preview`.
- Admin account: `superadmin@pinewoodcode.com`, with TOTP required. Generated credentials are in a protected server file and, with explicit owner approval, in ignored local `.deployment/admin-credentials.json`. Do not commit or print that file.
- Fresh server-only environment secrets; no local development secrets uploaded. MongoDB, Redis, RabbitMQ, workers, API, frontend and Mailpit have no published host ports. Only the TURN service publishes ports; HTTP/WSS goes through the existing Caddy proxy.
- Existing Pinewood services were retained. The original Caddyfile is backed up privately at `/home/shahab/apps/parley-preview/Caddyfile.before-parley`; only an additive Parley site was installed, validated and reloaded.
- Adult access and payments are disabled. Registration is disabled until real SMTP is configured. Mailpit is private and cannot deliver external email; the site displays a preview notice.

## Deployed checks

Backend/frontend image builds passed. HTTPS and API readiness passed. Public browser checks passed for text matching/messaging, direct synthetic video, closed Adult/checkout gates, and admin password/TOTP sign-in.

After the owner added inbound TCP/UDP 3478 and UDP 49160–49200 to the Hetzner firewall, TCP reachability passed. The first relay retest exposed same-server TURN traffic resolving to its own Docker address and being rejected by the private-peer deny rule. The deployment now discovers the container address at startup, sets explicit public/private mapping, and allows only its own address for hairpin relay calls. Other private-peer restrictions and allocation quotas remain enabled.

The final public `relay-only` Playwright test passed (9.1 seconds): both browsers rendered remote video and the connection indicator confirmed relaying. These were synthetic Chromium cameras from the local test computer to the remote Hetzner host, not physical devices on two separate client networks. All eight Parley containers and the existing Ghost/database containers reported healthy after the firewall change.

## Operations

Run from `/home/shahab/apps/parley-preview`:

```sh
sh deploy/hetzner/compose.sh ps
sh deploy/hetzner/compose.sh logs --tail 100 api workers
```

Do not run `down --volumes`: these are now persistent deployment volumes, not disposable validation data. Preserve `.env`, the TOTP encryption key and MongoDB data. No off-host backup schedule has been configured yet.

The overlay trusts only the observed Caddy address `172.19.0.3/32`; verify/update it if Caddy's proxy-network address changes. The temporary hostname depends on sslip.io DNS. When the owner supplies a domain, update the Caddy site, frontend/API origins, TURN realm and email configuration, then rebuild the frontend and coordinate the API rollout.

Physical mobile/desktop media permissions, separate client networks, restrictive-network TURN/TLS fallback, real SMTP, sustained load, encrypted off-host backups and abuse-response operations remain outstanding. This preview deployment does not certify those release gates. Source changes remained uncommitted at the time of this deployment report.

## GitHub and Jenkins preparation — 12 November 2026

The root monorepo preserves both original Git histories and uses `dev` for development, with `main` reserved for reviewed production releases. The new Jenkins pipeline validates branches and PRs, and permits production image delivery only for non-PR, non-tag `main` builds. Exact SHA-labelled images are transferred to the existing host, verified by image ID, started without rebuilding or changing infrastructure, and checked for internal/public health. Rollback image IDs are saved. See [GitHub/Jenkins commissioning](GITHUB_JENKINS.md).

Shell syntax, development/PR/tag deployment rejection tests, quiet Compose validation and indexed/history credential-pattern/path scans passed locally. No Jenkins controller execution or production deployment occurred. GitHub publishing is unavailable with the current invalid CLI authentication/read-only connector; protection, default branch, webhook and Jenkins credentials require administrator setup. Existing preview uses Caddy; no Nginx migration or staging environment was created. Launch gates above still apply before promoting `dev` into `main`.
