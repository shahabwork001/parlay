# 0005: Clean Architecture as folders, enforced by lint

Date: 2026-10-25. Status: Accepted.

## Context

Splitting layers into separate npm workspace packages adds build and versioning overhead for a single deployable codebase, but without enforcement folder boundaries erode.

## Decision

One package with `src/domain`, `src/application`, `src/infrastructure`, `src/api` and `src/workers`. ESLint `no-restricted-imports` rules fail the build when a layer imports an outer layer, or when the domain or application layers import drivers or frameworks.

## Consequences

Boundaries are as strict as with separate packages, while keeping one `tsconfig`, one test runner and one Docker build.
