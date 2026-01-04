# @iadev93/zuno

**Zuno** is a universal, event-driven state system designed to keep **client, server, and multiple runtimes** in sync with strong consistency guarantees.

Zuno is built around a simple idea:

> State is not local — it is **distributed, versioned, and observable**.

This package is the **core** of the Zuno ecosystem:

* State engine (Universe + Stores)
* Versioned event model
* Sync primitives (SSE + BroadcastChannel)
* Adapter contract (`ZunoReadable`) for UI/framework bindings
* Optional server helpers (snapshot + SSE handlers)

---

## Install

```bash
npm install @iadev93/zuno
```

---

## Quick Start (Client)

```ts
import { createZuno } from "@iadev93/zuno";

const zuno = createZuno();

const counter = zuno.store("counter", () => 0);

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

This contract is used by `@iadev93/zuno-react` and future adapters (Solid/Vue/Svelte/etc.).

---

## Server Usage (Optional Helpers)

If you want to host Zuno sync endpoints yourself (without `@iadev93/zuno-express`), the core package provides server-side utilities via the `@iadev93/zuno/server` entry point.

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

## Recommended: Express Integration

If you’re using Express, use the dedicated adapter:

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
