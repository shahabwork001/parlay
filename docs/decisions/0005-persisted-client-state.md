# 0005: Persisted Zustand stores hydrate after mount

Date: 2026-10-25. Status: Accepted.

## Context

Reading localStorage while creating a store makes the first client render differ from the server HTML, which causes hydration errors.

## Decision

Persisted stores use `skipHydration: true`; a `PreferencesHydrator` client component calls `persist.rehydrate()` in an effect.

## Consequences

No hydration mismatches. Persisted values appear immediately after mount, never during server render.
