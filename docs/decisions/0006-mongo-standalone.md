# 0006: Standalone MongoDB, single-document atomicity

Date: 2026-10-25. Status: Accepted.

## Context
Multi-document transactions need a replica set, which with authentication requires a keyfile and complicates local setup.

## Decision
Run MongoDB standalone locally. Model aggregates so each business operation changes one document atomically; cross-aggregate consistency is eventual, via integration events.

## Consequences
Simpler local setup. If a feature truly needs a transaction, switch Compose to a single-node replica set (keyfile + `--replSet`) under a new ADR. Production should run a replica set for availability regardless.
