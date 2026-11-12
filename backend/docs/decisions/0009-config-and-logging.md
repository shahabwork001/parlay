# 0009: zod-validated configuration and pino logging

Date: 2026-10-25. Status: Accepted.

## Context

Misconfiguration should fail at startup, not at the first request. Logs must be structured and must never contain personal data.

## Decision

- All configuration is read once from environment variables and validated with zod in `src/infrastructure/config/config.ts`. Invalid configuration throws a `ConfigError` that lists every problem. No other code reads `process.env`, except the OpenTelemetry preload, which uses OpenTelemetry's standard variables.
- Logging uses pino: JSON output in containers, pino-pretty locally. Request logs keep only id, method, URL and status. Authorization headers, cookies, passwords and tokens are redacted.

## Consequences

Startup failures are predictable, and log output is safe to ship to any log store.
