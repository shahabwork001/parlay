# 0008: Vitest, supertest and Testcontainers

Date: 2026-10-25. Status: Accepted. Replaces the original xUnit + FluentAssertions plan.

## Context

The original plan specified xUnit, FluentAssertions and Testcontainers for .NET.

## Decision

Vitest with two projects: `unit` (fast, no Docker) and `integration` (Testcontainers for real MongoDB, Redis and RabbitMQ, started once in a global setup). HTTP behaviour is tested in-process with supertest.

## Consequences

The backend uses the same test runner as the frontend. Integration tests need Docker and take about 20 to 30 seconds, including container start-up.
