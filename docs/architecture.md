# Architecture

Status: Phase 1 (foundation). Sections marked *planned* describe the target design that later phases implement; update them as features land.

## Components
```mermaid
flowchart LR
  subgraph Client
    FE[Next.js frontend]
  end
  subgraph Backend
    API[Parley.Api<br/>REST + SignalR]
    WK[Parley.Workers<br/>RabbitMQ consumers]
  end
  subgraph Infrastructure
    MDB[(MongoDB)]
    RDS[(Redis)]
    MQ[[RabbitMQ]]
    TURN[coturn]
    MAIL[Mailpit / SMTP]
  end
  FE -- HTTPS / WSS --> API
  FE -- STUN / TURN --> TURN
  FE <-. WebRTC media, peer to peer or relayed .-> FE
  API --> MDB
  API --> RDS
  API -- publish --> MQ
  MQ -- consume --> WK
  WK --> MDB
  WK --> RDS
  WK --> MAIL
  API -. SignalR backplane .-> RDS
```

### Layers
```mermaid
flowchart TB
  Api[Parley.Api] --> Application
  Workers[Parley.Workers] --> Application
  Api --> Infrastructure
  Workers --> Infrastructure
  Infrastructure[Parley.Infrastructure] --> Application[Parley.Application]
  Application --> Domain[Parley.Domain]
```
Dependencies point inwards. Infrastructure implements Application ports; hosts compose them.

## Messaging (implemented in Phase 1)
- One durable topic exchange `parley.events`; routing key = `IIntegrationEvent.RoutingKey` (versioned, e.g. `reports.created.v1`).
- Each subscriber declares its own quorum queue `parley.{subscriber}.{routingKey}` with `x-delivery-limit`; failures are requeued, and after the limit the message is dead-lettered through `parley.dead-letter` into `{queue}.dead-letter`. Malformed messages are dead-lettered immediately.
- Publisher confirms: `PublishAsync` completes once the broker has accepted the message.

```mermaid
flowchart LR
  P[Publisher] -->|routing key| X{{parley.events<br/>topic}}
  X --> Q1[parley.moderation.reports.created.v1]
  X --> Q2[parley.analytics.reports.created.v1]
  Q1 -->|delivery limit exceeded| DLX{{parley.dead-letter<br/>direct}}
  DLX --> D1[parley.moderation.reports.created.v1.dead-letter]
```

## Matchmaking flow (planned, Phase 3)
```mermaid
sequenceDiagram
  participant A as Client A
  participant H as ChatHub (API)
  participant R as Redis
  participant B as Client B
  A->>H: JoinQueue(mode, interests, language)
  H->>R: check bans / rate limit
  H->>R: EVAL pair.lua (atomic: find compatible waiting user or enqueue)
  alt partner found
    R-->>H: partner B, session id
    H-->>A: Matched(sessionId, role=caller)
    H-->>B: Matched(sessionId, role=callee)
  else nobody compatible
    R-->>H: enqueued
    H-->>A: Searching
  end
```

## WebRTC signaling (planned, Phase 4)
```mermaid
sequenceDiagram
  participant A as Caller
  participant H as ChatHub
  participant B as Callee
  participant T as coturn
  A->>H: GET TURN credentials (HMAC, short TTL)
  B->>H: GET TURN credentials
  A->>H: SendOffer(sdp)
  H-->>B: Offer(sdp)
  B->>H: SendAnswer(sdp)
  H-->>A: Answer(sdp)
  A->>H: SendIceCandidate
  H-->>B: IceCandidate
  A-->T: relay if direct path fails
  Note over A,B: on ICE failure the caller restarts ICE and renegotiates
```

## Moderation pipeline (planned, Phase 5)
```mermaid
flowchart LR
  R[Report / NSFW flag] --> API
  API -->|reports.created.v1| MQ[[RabbitMQ]]
  MQ --> W[Moderation worker]
  W --> C[IContentClassifier]
  W -->|priority score| Q[(Review queue in Mongo)]
  W -->|minor-safety| S[Instant suspension + evidence hold]
  Q --> M[Moderator UI]
  M -->|decision| API
  API -->|moderation.decided.v1| MQ
  MQ --> AUD[Audit log consumer]
```

## Health
- `/health/live`: process is running (used by container health checks).
- `/health/ready`: MongoDB ping, Redis ping, RabbitMQ connection. Returns 503 when any check fails. The payload exposes only component names and statuses.
