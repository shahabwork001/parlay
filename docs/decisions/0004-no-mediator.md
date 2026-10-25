# 0004: CQRS-lite without a mediator library

Date: 2026-10-25. Status: Accepted.

## Context

Runtime dispatch through a mediator hides call paths, and Express already provides middleware for cross-cutting concerns.

## Decision

Each use case is a command or query type plus a handler in `src/application/features/<feature>/`. Handlers are constructed in the composition root and passed explicitly to routers and socket handlers. Validation, authentication, authorization and rate limiting live in middleware.

## Consequences

Call paths are explicit and debuggable, and unit tests are simple (construct the handler with fakes). There is no pipeline-behaviour abstraction; if one becomes necessary, use function decorators.
