# 0006: Socket.IO client for real-time

Date: 2026-10-25. Status: Accepted. Replaces the planned `@microsoft/signalr` client.

## Context

The backend moved from .NET to Node.js + Express and uses Socket.IO with the Redis adapter for signaling and text chat (backend ADRs 0001 and 0002).

## Decision

Use `socket.io-client` 4. A single connection manager in `src/services/` owns the socket: automatic reconnection with backoff, auth token on the handshake, typed event maps shared with the backend contract, and zod validation of every inbound event.

## Consequences

Components never touch the socket directly; they use feature hooks backed by the connection manager and Zustand stores.
