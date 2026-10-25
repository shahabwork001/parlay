# 0007: CQRS-lite without a mediator library

Date: 2026-10-25. Status: Accepted.

## Context
Popular mediator libraries have moved to commercial licences, and runtime dispatch hides call paths.

## Decision
Each use case is a command or query record plus a handler class registered in DI. Endpoints and hub methods inject the handler they need. Cross-cutting concerns (validation, authorization, logging) live in endpoint filters, hub filters and middleware.

## Consequences
Explicit, debuggable call paths and no licence risk. No pipeline-behavior abstraction; if one becomes necessary, use decorators.
