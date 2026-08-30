# @iadev93/zuno

<p><b>The core state engine for Zuno.</b></p>

Zuno is a universal, event-driven state system designed to keep **client, server, and multiple runtimes** in sync with strong consistency guarantees.

This package provides the foundation:
- 🌌 **Universe**: Central coordination for all stores.
- 📦 **Store**: Versioned, observable state units.
- 🔄 **Sync Primitives**: SSE and BroadcastChannel transport implementations.
- 🔌 **Adapter Ready**: Exposes the `ZunoReadable` contract for UI bindings.

---

## Features

- 🚀 **Ultra-Fast**: 1000+ snapshots/ms with incremental caching.
- ⚡️ **Batching**: coalesces multiple updates into single network syncs.
- 🔄 **Real-time**: SSE and BroadcastChannel for multi-tab/multi-client sync.
- 🛡️ **Type-Safe**: TypeScript-first design.
- 🔌 **Adapters**: React, Angular, Express, Elysia.

## Install

```bash
npm install @iadev93/zuno
```

## Quick Start (Client)

```ts
import { createZuno } from "@iadev93/zuno";

const zuno = createZuno({
  // Optional: Enable batching for high-frequency updates
  batchSync: true,
  // Bound offline work and automatic conflict resolution.
  maxQueueSize: 100,
  maxConflictRetries: 3,
});

const counter = zuno.store(
  "counter", 
  () => 0, 
  undefined, 
  // Optional: Custom equality check
  (a, b) => a === b
);

await counter.set((v) => v + 1);
console.log(counter.get());
```

---

## Core Concepts

### Universe

A Universe is a container for many stores. It is responsible for:

* creating and caching stores by key
* coordinating versioned state events
* providing a stable API for sync/transports

### Store

A Store is keyed state.

* `get()` returns current snapshot
* `set(next)` updates state (supports functional updates)
* `subscribe(cb)` notifies on changes

### State Events (Versioned)

Zuno sync is driven by **versioned state events**. Each event includes:

* `storeKey`
* `state`
* `origin` (who produced it)
* `baseVersion` (what it was based on)
* `version` (monotonic)
* `eventId` (optional)

This enables deterministic ordering and protects against stale overwrites.

---

## Client Sync

Zuno supports multi-tab / multi-client synchronization.

### 1) Same-origin tabs (BroadcastChannel)

```ts
import { startBroadcastChannel } from "@iadev93/zuno";

startBroadcastChannel({
  channelName: "zuno-demo"
});
```

> BroadcastChannel works **only across the same origin**.

### 2) Multi-client sync (SSE)

```ts
import { startSSE } from "@iadev93/zuno";

startSSE({
  url: "/zuno/events",
  // optional: pass shared Maps for version bookkeeping
  // versions,
});
```

SSE is ideal for:

* low-latency state fanout
* CDN/proxy friendly infra
* avoiding WebSocket lock-in

On reconnect, the client sends its last observed event ID. The server replays retained events after that ID. If the requested range is no longer complete, the server sends an authoritative snapshot with the current event ID instead. Calling `stop()` permanently cancels the active connection, scheduled reconnects, queue flush timers, and browser online listener.

Client recovery is bounded by default:

* `maxQueueSize` limits mutations retained while offline (default: `100`)
* `maxConflictRetries` limits automatic retries for one conflict (default: `3`)
* retryable HTTP 5xx mutations remain queued instead of being silently discarded

By default the offline queue is held in memory. To preserve queued mutations across
page reloads, provide the IndexedDB adapter with a queue key unique to the current
application namespace or signed-in user:

```ts
import { createIndexedDBOfflineQueue, createZuno } from "@iadev93/zuno";

const zuno = createZuno({
  sseUrl: "/zuno/events",
  syncUrl: "/zuno/sync",
  offlineQueue: createIndexedDBOfflineQueue({
    databaseName: "my-app",
    queueKey: "tenant-a:user-123",
  }),
});
```

Custom persistence providers can implement the exported `ZunoOfflineQueue`
`load()`/`save()` contract. A failed durable write returns
`QUEUE_STORAGE_ERROR` rather than claiming that the mutation was safely queued.

Before flushing, queued state snapshots are coalesced by `storeKey`: Zuno keeps
the first mutation's `baseVersion` and sends only the latest state for that store.
For example, offline counter states `1 → 2 → 3` produce one sync request carrying
state `3`. Different store keys remain separate. This preserves final-state
convergence while avoiding redundant requests and repeated version conflicts.

---

## Adapter Contract (UI / Frameworks)

Zuno exposes a minimal adapter contract that can be consumed by any UI/runtime:

```ts
type ZunoReadable<T> = {
  getSnapshot(): T;
  subscribe(onChange: () => void): () => void;
  getServerSnapshot?: () => T;
};
```

Helper:

```ts
import { toReadable } from "@iadev93/zuno";

const readable = toReadable(store);
```

This contract is used by official adapters:
- `@iadev93/zuno-react`
- `@iadev93/zuno-angular` (New!)

---

## Server Usage (Optional Helpers)

If you want to host Zuno sync endpoints yourself (without `@iadev93/zuno-express`), the core package provides server-side utilities via the `@iadev93/zuno/server` entry point.

### Isolated server state

Create one server state instance per application or isolation boundary. State, replay events, and SSE listeners are private to that instance.

```ts
import {
  applyStateEvent,
  createZunoServerState,
} from "@iadev93/zuno/server";

const server = createZunoServerState({
  maxEvents: 1000,
  maxStateBytes: 512 * 1024,
  maxSubscriberBuffer: 1000,
});
const result = applyStateEvent(
  { storeKey: "counter", state: 1, baseVersion: 0 },
  server,
);
```

For multi-tenant routing, use `createZunoServerRegistry()` and select a namespace from trusted application context before invoking an adapter or server helper. Registry entries have independent state, replay logs, and listeners.

The original module-level helpers remain available and use `defaultZunoServerState` for backward compatibility. New applications should prefer explicit instances.

`maxSubscriberBuffer` bounds pending messages per SSE subscriber. A slow subscriber that exhausts its buffer is disconnected and can recover through replay or snapshot fallback on reconnect.

### Persistence and multiple server instances

Server state accepts a `ZunoServerPersistence` adapter for authoritative state
and replay history, plus a `ZunoServerEventBus` for live fan-out between server
instances. All instances for one namespace must share both resources.

```ts
import {
  createFileZunoServerPersistence,
  createZunoServerState,
} from "@iadev93/zuno/server";

const server = createZunoServerState({
  persistence: createFileZunoServerPersistence("./data/zuno.json"),
});
```

Persistence adapters must implement `compareAndSet()` atomically so two server
processes cannot accept mutations based on the same version. See the
[server persistence guide](../../docs/server-persistence.md) for the complete
contract, shared-bus example, and production guidance.

### Snapshot handler

The snapshot handler returns the current universe/store snapshot for new clients.

```ts
import { /* snapshot handler export */ } from "@iadev93/zuno/server";
```

### SSE connection + state publishing

Zuno’s SSE utilities typically do two jobs:

* register a client connection
* broadcast state events to connected clients

```ts
import { createSSEConnection, setUniverseState } from "@iadev93/zuno/server";
```

### Applying incoming events

Incoming events should be validated and applied using the core apply routine.

```ts
import { /* apply-state-event export */ } from "@iadev93/zuno/server";
```

---

## Framework Integration

- **React**: `npm install @iadev93/zuno-react`
- **Angular**: `npm install @iadev93/zuno-angular` (New!)
- **Express**: `npm install @iadev93/zuno-express`

For Express usage:

```bash
npm install @iadev93/zuno-express
```

It wires SSE + snapshot routes cleanly and keeps your core imports tidy.

---

## Public Exports

Core exports are intentionally minimal:

* `createZuno`, `CreateZunoOptions`
* `startSSE`, `startBroadcastChannel`
* `ZunoReadable`, `ZunoSubscribableStore`, `toReadable`
* (optional) server helpers if you choose to expose them

If you export server helpers from core, consider **server-only subpath exports** to prevent accidental client bundling.

---

If you’re using Zuno in a real project, please open an issue and tell us your use case.

---

## License

MIT
