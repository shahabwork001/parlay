# 0003: Pin FluentAssertions to 7.x

Date: 2026-10-25. Status: Accepted.

## Context
FluentAssertions 8 changed to a commercial licence for non-open-source use. The stack mandates FluentAssertions and free tooling.

## Decision
Pin `FluentAssertions` to the 7.x line (Apache 2.0) in `Directory.Packages.props`. Do not upgrade to 8.x.

## Consequences
No new features from 8.x. If 7.x stops receiving fixes, migrate to a licence-compatible fork (e.g. AwesomeAssertions) with a new ADR.
