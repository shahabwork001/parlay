# 0002: Repository layer over a single typed HTTP client

Date: 2026-10-25. Status: Accepted.

## Context

Components calling `fetch` directly scatter URLs, auth handling and response parsing, and leave responses untyped at runtime.

## Decision

One `HttpClient` handles base URL, credentials, bearer token, JSON and ProblemDetails errors. One repository per backend resource exposes typed methods and validates responses with zod. Components consume repositories through TanStack Query hooks. ESLint forbids `fetch` outside `src/lib/http`.

## Consequences

Backend contract drift fails loudly at the repository boundary. Repositories are easy to fake in tests.
