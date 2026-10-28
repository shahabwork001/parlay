# 0015: Launch free; defer monetisation, keep operator controls

Status: Accepted (2026-10-28)

## Context

The original plan (Phase 7) included premium plans, a payment-provider abstraction with a fake local provider, premium features and ad slots. The product owner decided to launch Parley free first, to see how people respond before choosing a business model.

## Decision

- **Deferred**: plans and subscriptions, payments, premium features, ad slots, and revenue on the admin dashboard. Their feature docs keep the design notes and are marked `Deferred` in FEATURES.md.
- **Built**: operator controls that do not involve money, as one site configuration: maintenance mode (with a message), an announcement banner, and switches for text chat, video chat and new accounts. Public read at `GET /api/v1/site`; edited at `/api/v1/admin/site` with `flags.manage`; every change audit-logged.
- **Caching**: the configuration is one small MongoDB document, cached in each API process for 15 seconds and applied at once on the instance that saved it. This replaces the planned Redis cache with RabbitMQ invalidation: at this size, a read every 15 seconds per instance is cheaper and has fewer moving parts. The public endpoint sends `Cache-Control: public, max-age=15`.
- **Enforcement on the server**: maintenance refuses socket connections and searches for everyone except staff; disabled modes refuse searches; closed registration returns 403. The frontend only reflects the state.

## Consequences

- Nothing in the code assumes a paid tier, and nothing has to be removed later. Adding one means building the deferred features: the `PaymentProvider` port, plans and entitlements, and premium checks at the gateway (priority queue, interest weighting) and in the UI.
- Configuration changes take up to 15 seconds to reach other API instances; maintenance does not end chats already in progress.
