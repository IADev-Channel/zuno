# Zuno Architecture

This document describes the high-level architecture of Zuno, its consistency model, and how state flows through the system.

Zuno's consistency claim is optimistic, server-authoritative eventual
consistency with version-based conflict detection. It does not provide
linearizable or strong consistency across replicas.

## High-Level Overview

Zuno is a **distributed state engine**. It treats state as a replicated, versioned log rather than a local memory object.

```mermaid
graph TD
    subgraph "Authority Tier"
        Persistence["Durable state + replay"]
        SyncEndpoint["POST /zuno/sync"]
        EventBus["Partition-aware event bus"]
    end

    subgraph "Stateless Connection Tier"
        GatewayA["Gateway A"]
        GatewayB["Gateway B"]
    end

    subgraph "Client A (Browser Tab 1)"
        UniverseA["Universe (Replica)"]
        StoreA["Store 'counter'"]
    end

    subgraph "Client B (Browser Tab 2)"
        UniverseB["Universe (Replica)"]
        StoreB["Store 'counter'"]
    end

    SyncEndpoint --> Persistence
    Persistence --> EventBus
    EventBus -- "Matching partitions/topics" --> GatewayA
    EventBus -- "Matching partitions/topics" --> GatewayB
    GatewayA -- "SSE state/control events" --> UniverseA
    GatewayB -- "SSE state/control events" --> UniverseB
    UniverseA -- "Propose Change" --> SyncEndpoint
    UniverseB -- "Propose Change" --> SyncEndpoint
    UniverseA <--> BC["BroadcastChannel"] <--> UniverseB
```

## Core Components

### 1. Universe
The **Universe** is the top-level container. It manages a registry of **Stores**. In a distributed Zuno mesh, there is one *authoritative* Universe (usually on the server) and many *replica* Universes (in browser tabs or client processes).

### 2. Store
A **Store** is a keyed unit of state (e.g., `counter`, `user_session`). 
- Stores are **versioned**. Every state update increments the version number.
- Stores are **observable**. You can subscribe to changes.

### 3. Replicas
A replica is any participation point in the mesh. Replicas synchronize with the authoritative server to maintain a consistent view of the world.

---

## State Flow & Connectivity

### Transport Layers

Zuno uses a multi-layered transport strategy to balance latency and reliability:

1.  **SSE (Server-Sent Events)**: The primary downstream channel. Stateless gateways stream accepted authoritative state changes only to matching subscribers.
2.  **HTTP POST Sync**: The upstream channel. Clients "propose" state changes to the server.
3.  **BroadcastChannel**: A local optimization. Same-origin browser tabs share state updates directly.
4.  **Mutation Batching**: Multiple synchronous updates are coalesced into a single network payload to reduce chatter.

SSE recovery is event-ID based. A reconnecting replica receives the complete retained range after its last event ID; if that range has been truncated, the server sends a full authoritative snapshot instead. Client mutation queues, conflict retries, and server subscriber buffers are bounded so disconnections and slow consumers cannot grow memory or retry indefinitely. Before an offline queue flushes, state snapshots are coalesced by store key: the first authoritative base version is preserved while only the latest proposed state is sent.

Authoritative server storage is pluggable. A persistence adapter atomically
compares the proposed base version, updates the universe, assigns an event ID,
and appends the replay log. The SQLite WAL adapter also provides partitioned
idempotency, ranged replay, snapshots, tombstones, and compaction. Ephemeral
events bypass durable state. Multiple server instances share authority and use
a partition-aware event bus with consumer offsets to fan accepted events out to
connection gateways without redelivering consumed offsets. Gateways retain only
bounded connection/subscription indexes, enforce admission and per-principal
limits, emit configurable heartbeats, and evict slow consumers with a typed
`RESYNC_REQUIRED` event. This keeps conflict and retry decisions in storage
rather than process-local maps.

Every event received through SSE is server-approved and therefore authoritative.
The original client origin is used only to suppress same-client loopback. This
lets a live event replace a stale replica whose optimistic version moved ahead
while offline; otherwise that replica would converge only after a refresh.

### Consistency Model: "Optimistic Convergent Consistency"

Zuno favors simplicity and predictability over complex conflict resolution like CRDTs.

1.  **Optimistic Update**: A client applies a change locally *immediately* and broadcasts it via `BroadcastChannel`.
2.  **Propose**: The client sends the change to the server via `POST /zuno/sync`, including the `baseVersion` it observed.
3.  **Validate**: The server checks if `baseVersion === currentVersion`.
    -   **Success**: The server increments the version, updates its authoritative state, and broadcasts the event via SSE.
    -   **Conflict (409)**: The server rejects the change and returns the *current* authoritative state.
4.  **Reconcile**: If a conflict occurs, the client rolls back (or merges) and must retry against the new authoritative state.

---

## Monorepo Structure

-   `packages/zuno`: The core state engine and sync primitives.
-   `packages/zuno-react`: React bindings (`useSyncExternalStore`).
-   `packages/zuno-angular`: Angular bindings (Signals & Observables).
-   `packages/zuno-express`: Server adapter for Node.js Express.
-   `packages/zuno-elysia`: Server adapter for Bun/Elysia.

## Technical Choices

-   **Why SSE instead of WebSockets?** SSE is simpler to implement, works over standard HTTP/1.1 and HTTP/2, is proxy-friendly, and naturally handles downstream-only streaming which fits 90% of state sync needs.
-   **Why versioning?** Versioning provides a clear "happen-before" relationship without needing vector clocks or complex timestamps.
