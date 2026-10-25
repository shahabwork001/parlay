# 0004: Guid v7 ids and optimistic concurrency

Date: 2026-10-25. Status: Accepted.

## Context
Ids are generated in the domain before persistence, must not expose Mongo types, and should index well. Concurrent moderator actions on the same aggregate must not silently overwrite each other.

## Decision
Entities use `Guid.CreateVersion7()` (time-ordered) stored with the standard BSON UUID representation. Aggregates carry a `Version`; `UpdateAsync` replaces only when the stored version matches and returns `false` on conflict.

## Consequences
Ids are sortable by creation time and portable. Handlers must treat `false` from `UpdateAsync` as a conflict (reload and retry, or return `Error.Conflict`).
