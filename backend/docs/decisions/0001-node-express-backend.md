# 0001: Node.js + Express + TypeScript backend

Date: 2026-10-25. Status: Accepted. Supersedes the original .NET 10 stack choice.

## Context

The backend was first scaffolded on .NET 10, but NuGet (api.nuget.org) is unreachable from the development network, so it could never be restored or built. The product owner decided to switch the backend to Node.js and Express. npm is reachable, and the frontend already uses TypeScript.

## Decision

Node.js 24 LTS, Express 5 and TypeScript (strict, ESM, NodeNext), mapping the original stack to: the official `mongodb` driver, `ioredis`, `amqplib`, zod (validation and configuration), pino (logging), the OpenTelemetry Node SDK, Helmet, Vitest, supertest and Testcontainers. Two processes from one codebase: the API and the workers.

## Consequences

- One language across frontend and backend; zod schemas can be shared later if useful.
- Express provides no DI, validation or ProblemDetails, so we build thin, tested equivalents (composition root, `validate()`, `sendProblem()`).
- CPU-heavy work (content classification) must stay in the workers, never on the API event loop.
