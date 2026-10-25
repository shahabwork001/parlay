# Feature: Platform foundation

Status: Done
Last updated: 2026-10-25

## Purpose

Solution structure, configuration, logging, telemetry, health checks, error handling, Docker and CI that every other feature builds on.

## User stories / use cases

- As an operator, I can start the whole stack with one command.
- As an operator, I can see whether the API and its dependencies are healthy.
- As a developer, I get consistent ProblemDetails errors, structured logs and traces.

## API endpoints / hub methods / events involved

- GET {API}/health/ready via SystemRepository (status page)

## Data model

Client-only: parley.preferences in localStorage (interests, language).

## Business rules

- Configuration comes from environment variables validated with zod at startup (fail fast, every problem listed); secrets only from environment.
- Unhandled exceptions return RFC 7807 ProblemDetails without internal details.
- Health: /health/live (process up) and /health/ready (MongoDB, Redis, RabbitMQ).
- Containers run as non-root.

## Current state (what works, what's missing, known issues)

Done: Next.js 16 App Router (Cache Components + Partial Prefetching), TypeScript strict, Tailwind v4 + shadcn/ui (Radix), zinc palette + teal accent with light/dark themes, Geist font (local), typed HttpClient + repository layer, TanStack Query, Zustand, security headers/CSP, ESLint + Prettier, Vitest + Testing Library, Playwright, standalone Docker image (non-root), CI workflow.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
