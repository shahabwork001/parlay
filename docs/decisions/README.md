# Architecture Decision Records

Short records of significant technical choices. Template: Context, Decision, Consequences. Never edit an accepted ADR's decision; supersede it with a new one.

| ADR                                  | Title                                                                  | Status   |
| ------------------------------------ | ---------------------------------------------------------------------- | -------- |
| [0001](0001-node-express-backend.md) | Node.js + Express + TypeScript backend                                 | Accepted |
| [0002](0002-socket-io.md)            | Socket.IO with the Redis adapter for real-time                         | Accepted |
| [0003](0003-amqplib-and-retries.md)  | amqplib and consumer-counted retries                                   | Accepted |
| [0004](0004-no-mediator.md)          | CQRS-lite without a mediator library                                   | Accepted |
| [0005](0005-layering-by-lint.md)     | Clean Architecture as folders, enforced by lint                        | Accepted |
| [0006](0006-ids-and-concurrency.md)  | UUID v7 ids, explicit mapping, optimistic concurrency                  | Accepted |
| [0007](0007-mongo-standalone.md)     | Standalone MongoDB, single-document atomicity                          | Accepted |
| [0008](0008-testing-stack.md)        | Vitest, supertest and Testcontainers                                   | Accepted |
| [0009](0009-config-and-logging.md)   | zod-validated configuration and pino logging                           | Accepted |
| [0010](0010-session-tokens.md)       | Short-lived JWT access tokens and rotating refresh cookies             | Accepted |
| [0011](0011-redis-matchmaking.md)    | Matchmaking in atomic Redis Lua scripts                                | Accepted |
| [0012](0012-moderation-pipeline.md)  | Synchronous safety actions, asynchronous scoring, pluggable classifier | Accepted |
| [0013](0013-bans-trust-and-pools.md) | Bans with a Redis write-through cache; trust and shadow bans as pools  | Accepted |
| [0014](0014-admin-read-side.md)      | Admin read side plus audited commands; server-side staff tool          | Accepted |
| [0015](0015-free-launch.md)          | Launch free; defer monetisation, keep operator controls                | Accepted |
