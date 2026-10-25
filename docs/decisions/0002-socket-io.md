# 0002: Socket.IO with the Redis adapter for real-time

Date: 2026-10-25. Status: Accepted.

## Context

Signaling and text chat need bidirectional messaging with reconnection, rooms and horizontal scaling. SignalR has no maintained server for Node.js.

## Decision

Socket.IO 4 on the API process, with `@socket.io/redis-adapter` so events reach sockets connected to any instance. The frontend uses `socket.io-client`. Every event payload is validated with zod and authorized per call.

## Consequences

Reconnection with backoff, acknowledgements and rooms come out of the box. Sticky sessions are needed only while HTTP long-polling is enabled; we prefer the WebSocket transport and keep polling as a fallback behind sticky sessions in production.
