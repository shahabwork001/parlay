# 0007: Standalone MongoDB, single-document atomicity

Date: 2026-10-25. Status: Accepted.

## Context

Multi-document transactions need a replica set, which with authentication requires a keyfile and complicates local setup.

## Decision

Run MongoDB standalone locally. Model aggregates so that each business operation changes one document atomically; cross-aggregate consistency is eventual, through integration events.

## Consequences

Local setup stays simple. If a feature truly needs a transaction, switch Compose to a single-node replica set under a new ADR. Production should run a replica set for availability regardless. Integration tests use the Testcontainers MongoDB module (a single-node replica set) with `directConnection=true`.
