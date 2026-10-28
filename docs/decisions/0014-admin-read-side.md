# 0014: Admin API as a read side plus audited commands, and a server-side staff tool

Status: Accepted (2026-10-28)

## Context

The admin panel lists and searches across reports, bans, accounts, sign-ins and the audit log, with filters and paging, and staff act on single aggregates (a report, a ban, an account). Loading aggregates to render lists would be slow and would push UI concerns into the domain. Staff access is sensitive: every action must be attributable, and the first staff with two-factor authentication need a way in that does not depend on the UI.

## Decision

- **Read side**: `AdminReadModel` (port) with a MongoDB implementation that queries projections directly (`reports`, `bans`, `users`, `refresh_tokens`, `audit_log`) and returns flat summaries. Live numbers come from Redis (`LiveStats`), queue depths from passive RabbitMQ checks (`QueueInspector`). This extends the CQRS-lite approach of [ADR 0004](0004-no-mediator.md).
- **Commands**: one use case per staff action (`DecideReport`, `RecordEscalation`, `IssueManualBan`, `LiftBan`, `DecideAppeal`, `SetStaffRoles`, `UpdateTextRules`), each loading and saving aggregates with optimistic concurrency and writing an audit entry with the staff actor.
- **Authorisation**: every `/api/v1/admin` route declares one permission and requires a two-factor session (`requirePermission`). Minor-safety decisions and evidence additionally need `moderation.escalate`, checked in the use case.
- **Response mapping**: aggregates are mapped field by field (`admin-contract.ts`); network hashes, password hashes and TOTP secrets never reach responses.
- **Staff bootstrap**: `create-staff` (run in the API container) creates a staff account with 2FA enabled and prints the credentials once. It is also how the end-to-end tests get a moderator. It never modifies existing accounts.
- **One queue list**: `WORKER_SUBSCRIPTIONS` defines every worker subscription; the workers build their consumers from it and the system view inspects the same queues (a unit test keeps them in step).

## Consequences

- List views stay fast and independent of aggregate shape; projections must be updated when documents change shape (the read model reads only the fields it needs and tolerates missing ones).
- The UI's permission map is a mirror for presentation only; the API remains the authority.
- Anyone with shell access to the API container can create staff. That access already implies control of the secrets, so the tool adds no new trust boundary.
