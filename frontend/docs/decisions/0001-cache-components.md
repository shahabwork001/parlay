# 0001: Cache Components and Partial Prefetching

Date: 2026-10-25. Status: Accepted.

## Context

Next.js 16.4 scaffolds new apps with `cacheComponents` and `partialPrefetching`, and both become the default in the next major. The landing page must reach Lighthouse 90+.

## Decision

Keep both enabled. Pages are static shells by default; dynamic data streams inside Suspense boundaries or is fetched client-side with TanStack Query.

## Consequences

Fast static public pages and route-level code splitting. Server code must not read time, randomness or request data during prerender outside `"use cache"` or Suspense.
