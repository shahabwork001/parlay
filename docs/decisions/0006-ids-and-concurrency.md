# 0006: UUID v7 ids, explicit mapping, optimistic concurrency

Date: 2026-10-25. Status: Accepted.

## Context

Ids are generated in the domain before persistence, must not expose Mongo types, and should index well. Concurrent moderator actions on one aggregate must not silently overwrite each other.

## Decision

Entities use UUID v7 strings (time-ordered), stored as `_id`. Each repository maps between aggregate and document explicitly (`toDocument`/`toAggregate`), so no BSON conventions or decorators reach the domain. Aggregates carry a `version`; `update()` replaces the document only when the stored version matches, and returns `false` on conflict.

## Consequences

Ids are portable and sort by creation time, and persistence details stay inside repositories. Handlers must treat `false` from `update()` as a conflict: reload and retry, or return `AppErrors.conflict`.
