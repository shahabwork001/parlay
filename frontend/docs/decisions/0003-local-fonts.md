# 0003: Geist from the `geist` package (local files)

Date: 2026-10-25. Status: Accepted.

## Context

`next/font/google` downloads fonts at build time, which fails on restricted networks and in offline CI or Docker builds.

## Decision

Use the `geist` npm package, which ships the font files and wraps `next/font/local`.

## Consequences

Builds are hermetic. Fonts are self-hosted with the same optimisations (preload, `size-adjust` fallbacks).
