# Features

Repository/delivery preparation (2026-11-12): root monorepo preserves original histories, development is on `dev`, and Jenkins delivery is restricted to non-PR `main` builds. Remote publication/settings and live Jenkins execution remain unconfigured. See [setup](../docs/GITHUB_JENKINS.md).

Single source of truth for the state of the frontend. Update this table and the linked feature doc with every change.

Status values: Not started, In progress, Done, Blocked, Deferred (decided not to build for now).

| Feature                              | Status      | Layer   | Phase | Doc                                                                                |
| ------------------------------------ | ----------- | ------- | ----- | ---------------------------------------------------------------------------------- |
| Platform foundation                  | Done        | FE + BE | 1     | [docs/features/foundation.md](docs/features/foundation.md)                         |
| Landing page                         | In progress | FE      | 1     | [docs/features/landing-page.md](docs/features/landing-page.md)                     |
| Static pages                         | Done        | FE      | 2     | [docs/features/static-pages.md](docs/features/static-pages.md)                     |
| Age and terms gate                   | Done        | FE + BE | 2     | [docs/features/age-terms-gate.md](docs/features/age-terms-gate.md)                 |
| Anonymous sessions                   | Done        | FE + BE | 2     | [docs/features/anonymous-sessions.md](docs/features/anonymous-sessions.md)         |
| Accounts and authentication          | Done        | FE + BE | 2     | [docs/features/accounts.md](docs/features/accounts.md)                             |
| Roles and permissions                | In progress | FE + BE | 2     | [docs/features/roles-permissions.md](docs/features/roles-permissions.md)           |
| Staff two-factor authentication      | Done        | FE + BE | 2     | [docs/features/staff-2fa.md](docs/features/staff-2fa.md)                           |
| Interest and language matching       | Done        | FE + BE | 3     | [docs/features/interest-matching.md](docs/features/interest-matching.md)           |
| Text chat                            | Done        | FE + BE | 3     | [docs/features/text-chat.md](docs/features/text-chat.md)                           |
| Presence and disconnect detection    | Done        | FE + BE | 3     | [docs/features/presence.md](docs/features/presence.md)                             |
| Block and skip history               | Done        | FE + BE | 3     | [docs/features/block-history.md](docs/features/block-history.md)                   |
| Video chat                           | Done        | FE + BE | 4     | [docs/features/video-chat.md](docs/features/video-chat.md)                         |
| WebRTC signaling and TURN            | Done        | FE + BE | 4     | [docs/features/webrtc-signaling.md](docs/features/webrtc-signaling.md)             |
| User settings                        | Done        | FE      | 4     | [docs/features/settings.md](docs/features/settings.md)                             |
| In-chat reporting                    | Done        | FE + BE | 5     | [docs/features/reporting.md](docs/features/reporting.md)                           |
| Client-side NSFW screening           | Done        | FE + BE | 5     | [docs/features/client-nsfw-screening.md](docs/features/client-nsfw-screening.md)   |
| Text moderation                      | Done        | FE + BE | 5     | [docs/features/text-moderation.md](docs/features/text-moderation.md)               |
| Ban system                           | Done        | FE + BE | 5     | [docs/features/ban-system.md](docs/features/ban-system.md)                         |
| Minor safety escalation              | Done        | FE + BE | 5     | [docs/features/minor-safety.md](docs/features/minor-safety.md)                     |
| No chat recording                    | Done        | FE + BE | 5     | [docs/features/no-chat-recording.md](docs/features/no-chat-recording.md)           |
| Ban and appeal experience            | Done        | FE + BE | 5     | [docs/features/ban-appeal.md](docs/features/ban-appeal.md)                         |
| Admin dashboard                      | Done        | FE + BE | 6     | [docs/features/admin-dashboard.md](docs/features/admin-dashboard.md)               |
| Moderation queue                     | Done        | FE + BE | 6     | [docs/features/admin-moderation-queue.md](docs/features/admin-moderation-queue.md) |
| Users and devices                    | Done        | FE + BE | 6     | [docs/features/admin-users.md](docs/features/admin-users.md)                       |
| Bans and appeals admin               | Done        | FE + BE | 6     | [docs/features/admin-bans-appeals.md](docs/features/admin-bans-appeals.md)         |
| Word lists and rules                 | Done        | FE + BE | 6     | [docs/features/admin-rules.md](docs/features/admin-rules.md)                       |
| Staff management                     | Done        | FE + BE | 6     | [docs/features/admin-staff.md](docs/features/admin-staff.md)                       |
| Audit log                            | Done        | FE + BE | 6     | [docs/features/audit-log.md](docs/features/audit-log.md)                           |
| System health                        | Done        | FE + BE | 6     | [docs/features/system-health.md](docs/features/system-health.md)                   |
| Plans and subscriptions              | Deferred    | FE + BE | 7     | [docs/features/plans-subscriptions.md](docs/features/plans-subscriptions.md)       |
| Premium features                     | Deferred    | FE + BE | 7     | [docs/features/premium-features.md](docs/features/premium-features.md)             |
| Feature flags and site configuration | Done        | FE + BE | 7     | [docs/features/feature-flags.md](docs/features/feature-flags.md)                   |
| Ad slots                             | Deferred    | FE      | 7     | [docs/features/ad-slots.md](docs/features/ad-slots.md)                             |

## Product transformation

Admin viewport update (2026-10-31): full-window admin shell with a stable header and internal content/sidebar scrolling. Deployed dashboard and report queue passed viewport-fit, overflow and accessibility checks at desktop, short-window and phone sizes.

Video controls update (2026-10-31): users can choose layout and fit/fill, resize/reposition/hide/mirror their preview, select devices during calls, reset the view and use full screen when supported. Phone interaction and settings accessibility browser checks passed on the deployed preview.

Mobile video update (2026-10-31): full-frame camera display, large primary video with expandable inset self-preview, and a taller phone preflight. Deployed preview passed camera preflight, forced TURN, and 390×844 layout/view-swap browser checks. See [video chat](docs/features/video-chat.md).

Interaction modes: Phase 1 implemented; verification-required access remains unavailable pending Phase 2. See [interaction modes](docs/features/interaction-modes.md) and the workspace [roadmap](../docs/PRODUCT_ROADMAP.md).

## Free MVP priorities (supersede monetization expansion)

- Core reliability: report recovery, idempotent trust effects, required indexes before startup and deliberate WebSocket transport implemented in this increment; real-network launch validation remains open.
- Premium: pricing preview and private opt-in waitlist; billing foundations retained but live payments deferred and disabled.
- Age assurance: durable provider/status foundation with ADULT_CHAT_ENABLED=false; no approved provider, no fake verified age.
- Product insights: first-party UTC activity aggregates, sampled p95 wait, self-reported RTC setup results and waitlist conversion in the admin dashboard.
  See [free MVP](docs/features/free-mvp.md) and the workspace roadmap.
