# Zuno  
### Universal Real-Time State Management & Sync Engine

Zuno is a lightweight, framework-agnostic architecture for **synchronizing state between client and server in real time**.  
It provides a unified “universe” store, an event-driven state bus, Server-Sent Events for live updates, and a pluggable transport system for bi-directional communication.

Zuno is designed as a *foundation-level* project—similar to what powers frameworks like LiveView, Remix loaders, Solid signals, and Zustand stores—but fully environment-agnostic.

---

## 🚀 Features

- ⚡ **Real-time client ↔ server state synchronization**  
- 🌍 **Universal “Universe Store”** shared across processes  
- 📡 **SSE-based broadcast pipeline** for server → client updates  
- 🔁 **Transport system** (HTTP, SSE, InMemory; WS coming soon)  
- 🧩 **Pluggable architecture** for future framework adapters  
- 🔧 **Event-driven core with shared pub/sub bus**  
- 📦 Zero dependencies, simple and fast  
- 🧪 Perfect foundation for multi-user, dashboard, and real-time UIs

---

## 🧱 Architecture Overview

Zuno's architecture is built around four core modules:

### **1. Universe Store**
A global registry of reactive stores.  
Each store is accessed via:

```ts
universe.getStore("counter", () => 0);
```
This ensures a single shared instance per key.

2. State Bus (Pub/Sub)

All state changes pass through an internal event bus:

```ts
publishToStateEvent(event);
subscribeToStateEvents(handler);
```

This powers real-time broadcasting.

3. Transport Layer (Client → Server)

Zuno uses pluggable transports so apps can decide how state sync happens.

Included today:

- `HttpTransport` → simple POST sync

- `InMemoryTransport` → SSR/tests

- `SSETransport` (server → client)

Upcoming:

- WebSocket transport

- BroadcastChannel (multi-tab sync)

4. SSE Stream (Server → Client)

Server emits real-time events to all connected clients:

```ts
createSSEConnection(req, res);
```

Clients reactively update local stores:

```ts
startSSE({ universe, url: "/zuno/sse" });
```

### 🏗️ Project Layout

```dir
/core
  universe.ts                     → Global store registry
  store.ts                        → Store implementation

/server
  sse-handler.ts                  → SSE endpoint + event streaming
  universe-store.ts               → Server-side universe storage
  state.bus.ts                    → Core pub/sub event bus
  inmemory-transport.ts           → InMemoryTransport

/sync
  sse-client.ts                   → Client-side SSE listener
  sync-core.ts                    → Sync core
  transport.ts                    → Transport interface

/examples
  exercise-server.ts              → Demo SSE server
  exercise-client.ts              → Demo browser client
  exercise-index.html             → Demo browser client
  exercise-memory-management.ts   → Demo memory management
```

🧪 Example: Real-Time Counter Sync
Client

```ts
const universe = createUniverse();
startSSE({ universe, url: "/zuno/sse" });

const counter = universe.getStore("counter", () => 0);
counter.subscribe((value) => {
  console.log("Counter updated:", value);
  transport.publish({ storeKey: "counter", state: value });
});

counter.set(Math.random());
```
## Server

```ts
import { applyStateEvent } from "./sync-core";

applyStateEvent({
  storeKey: "counter",
  state: Math.random(),
});
```

This update instantly shows on all connected clients.

🗺️ Roadmap
# Level 1 — Core (DONE)

✔ Universe store
✔ Event bus
✔ SSE server
✔ Sync transport (HTTP + SSE)
✔ Real-time update propagation

# Level 2 — Transport Layer

⬜ WebSocket transport

⬜ BroadcastChannel (multi-tab sync)

# Level 3 — Framework Adapters

⬜ React adapter (useZunoStore)

⬜ Solid.js adapter

⬜ Vue adapter

⬜ Angular adapter

# Level 4 — DevTools

⬜ Store inspector panel

⬜ Event timeline

⬜ Time-travel state playback

# Level 5 — Local/Testing Storage

⬜ In-memory adapter

⬜ JSON file adapter

⬜ SQLite adapter

# Level 6 — Cloud DB Integration

⬜ Firebase adapter

⬜ Supabase adapter

⬜ Postgres adapter

# Level 7 — Multi-Tenant & Auth

⬜ Rooms / channels

⬜ Namespaced universes

⬜ Secure event validation

# Level 8 — Offline Mode

⬜ Event queueing

⬜ Auto-reconnect

⬜ Conflict resolution strategies

# Level 9 — Analytics

⬜ GTM integration

⬜ Other analytics integration

🤝 Contributing

Zuno is in early exploration stage.
Ideas, issues, and PRs are welcome — especially around adapters, transports, and devtools.

📄 License

MIT License — free for personal and commercial use.

⭐ Inspiration

Zuno draws conceptual inspiration from:

- Phoenix LiveView

- Solid.js Signals

- Zustand

- Remix loader/streaming

- Meteor reactivity

But is fully hand-rolled and environment-agnostic.

🌌 Final Thoughts

Zuno is the foundation of a universal real-time engine.
You can build:

- dashboards

- SaaS tools

- collaboration apps

- multi-user state systems

- real-time viewers

…and eventually a full framework.

Stay tuned for more upgrades.