# Zuno

**Zuno** is a transport-agnostic, event-driven **universal state replication engine**.

It is **not** a typical UI state manager.
Zuno focuses on **how state exists, synchronizes, and converges** across tabs, runtimes, and (optionally) servers — while keeping developer experience minimal.

---

## ✨ What makes Zuno different?

Most state libraries answer:

> *“How do I update UI efficiently?”*

Zuno answers:

> *“How does state move, synchronize, and stay consistent across replicas?”*

Zuno works:

* without React
* without Context / Providers
* without Redux-style boilerplate
* without a server (optional)

And still scales **from local-only → multi-tab → real-time server sync**.

---

## 🧠 Mental Model

Zuno is built on four simple concepts:

### 1) Universe

A **Universe** is a collection of independent stores.
Each store is identified by a `storeKey`.

### 2) Store

A store holds a single piece of state and supports:

* `get()`
* `set()`
* `subscribe()`

### 3) Event

Every mutation is an **event**:

```ts
{ storeKey, state, origin?, version?, baseVersion? }
```

Events are **transport-agnostic**.

### 4) Transport

Transports move events between replicas:

* Local (in-memory)
* BroadcastChannel (multi-tab)
* SSE + HTTP (server sync)

---

## 🚀 Features

* ✅ Framework-agnostic core
* ✅ Vanilla JS friendly
* ✅ React adapter (no providers)
* ✅ Multi-tab sync via BroadcastChannel
* ✅ Optional server sync (SSE + POST)
* ✅ Snapshot + replay for late-joining replicas
* ✅ Optimistic updates
* ✅ Extremely small API surface

---

## ⚠️ Important Notes

### BroadcastChannel scope

**BroadcastChannel only syncs tabs that share the same origin** (scheme + host + port).
That means:

* ✅ `http://localhost:5173` tab ↔ `http://localhost:5173` tab
* ❌ `http://localhost:5173` tab ↔ `http://localhost:3000` tab

If your demos are on different ports/hosts, use **server sync (SSE + HTTP)** (or run both under the same origin via a proxy).

### SSE lifecycle

SSE connections end when the page/tab is closed.
Use snapshot + replay to hydrate late joiners when they reconnect.

---

## 📦 Installation

```bash
pnpm add zuno
```

(React is an optional peer dependency.)

---

## ✅ Quickstart (Vanilla)

```ts
import { createZuno } from "zuno";

const zuno = createZuno({
  channelName: "zuno-demo",
  optimistic: true,
});

const counter = zuno.store<number>("counter", () => 0);

counter.subscribe((v) => {
  console.log("counter:", v);
});

counter.set((p) => p + 1);
```

Open the same page in two tabs — they stay in sync.

---

## 🔁 Multi-tab Sync (BroadcastChannel)

```ts
const zuno = createZuno({
  channelName: "zuno-multitab",
});
```

Zuno automatically:

* discovers other tabs
* hydrates new tabs via snapshot
* syncs future updates via events

No server required.

---

## 🌐 Server Sync (Optional)

```ts
const zuno = createZuno({
  channelName: "zuno",
  sseUrl: "http://localhost:3000/zuno/sse",
  syncUrl: "http://localhost:3000/zuno/sync",
  optimistic: true,
});
```

* SSE provides snapshots + authoritative updates
* HTTP POST sends mutations
* BroadcastChannel still gives instant local-tab sync (same-origin only)

---

## ⚛️ React Usage

### Create a React-enabled Zuno

```ts
import { createZunoReact } from "zuno/react";

export const zuno = createZunoReact({
  channelName: "zuno-react",
});
```

> ⚠️ Call this at **module scope**, not inside components.

### Using a bound store

```tsx
const counter = zuno.store<number>("counter", () => 0);

function App() {
  const count = counter.use();

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => counter.set((p) => p + 1)}>+</button>
    </div>
  );
}
```

No Provider. No Context. No reducers.

---

## 🎯 When should you use Zuno?

Zuno is ideal for:

* cross-tab state
* auth/session state
* feature flags
* collaborative UIs
* admin dashboards
* streaming / media apps
* offline-first tools

Zuno is **not** meant to replace all UI-local state.
Use it where **state needs to exist beyond a single component tree**.

---

## 🧩 Architecture Overview

```
[ Store ]
    ↑
[ Universe ]
    ↑
[ Event ]  ←── created by set()/dispatch()
    ↑
[ Transport ]
    ├─ Local (in-memory)
    ├─ BroadcastChannel (multi-tab)
    └─ SSE + HTTP (server)
```

* **Universe** owns stores
* **Stores** are isolated and deterministic
* **Events** describe state transitions
* **Transports** replicate events between replicas

---

## 📚 Core API (Stable)

### `createZuno(options)`

Creates a Zuno instance.

```ts
const zuno = createZuno({
  channelName?,
  sseUrl?,
  syncUrl?,
  optimistic?,
});
```

### `zuno.store(key, init)`

Creates a bound store.

```ts
const counter = zuno.store<number>("counter", () => 0);
```

Returns:

* `get()`
* `set(next | updater)`
* `subscribe(cb)`
* `raw()` (escape hatch)

### `zuno.set(key, next, init?)`

Low-level setter (used internally by bound stores).

### `zuno.dispatch(event)`

Advanced API for power users.

```ts
zuno.dispatch({ storeKey: "counter", state: 5 });
```

### `zuno.stop()`

Stops transports and listeners.

---

## ⚛️ React Adapter API (Stable)

### `createZunoReact(options)`

Convenience wrapper around `createZuno + bindReact`.

```ts
const zuno = createZunoReact({ channelName: "zuno-react" });
```

### `counter.use(selector?, equality?)`

React hook bound to a store.

```tsx
const count = counter.use();
const doubled = counter.use((c) => c * 2);
```

Uses `useSyncExternalStore` internally.

---

## 🧪 Guarantees

Zuno guarantees:

* Deterministic local updates
* Eventual consistency between replicas
* No duplicate self-events
* Late join convergence

Zuno does **not** guarantee:

* Strong consistency
* Conflict-free merges (CRDT-level)

---

## 🛑 Non-Goals

Zuno intentionally does **not**:

* Replace all UI-local state
* Provide reducers or actions
* Handle complex CRDT merges
* Abstract networking concerns beyond transports

---

## 🧩 Adapters Roadmap

Adapters are intentionally thin bindings over the core.

Planned / in-progress:

* ✅ Vanilla JS (core)
* ✅ React
* ⏳ Next.js (SSR & hydration adapter layer)
* ⏳ Solid
* ⏳ Vue
* ⏳ Svelte
* ⏳ Angular

---

## 🧊 Project Status

* ✅ Core complete (v0)
* ✅ BroadcastChannel transport
* ✅ SSE transport
* ✅ React adapter

Zuno is currently **stabilizing (Level 2.5)** → next: **Framework Adapters (Level 3)**.

---

## 📜 License

MIT © IADev
