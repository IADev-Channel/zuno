<div align="center">
  <img src="./zuno.png" alt="Zuno Logo" width="120" />
  <h1>Zuno</h1>
  <p><b>Universal, event-driven state synchronization with strong consistency.</b></p>
  <p>Client, server, and multiple runtimes — perfectly in sync.</p>
</div>

---

**Zuno** is a distributed state engine built on a simple premise:
> "State is not local — it is distributed, versioned, and observable."

It ensures that every mutation across your ecosystem (tabs, background workers, node servers, even different runtimes like Bun or Elysia) is deterministic and consistent.

## 🚀 Key Features

- ⛓️ **Deterministic Ordering**: Versioned events prevent stale overwrites and race conditions.
- 🔄 **Multi-Runtime Sync**: Seamlessly sync state between Browser Tabs, Node.js, Express, and Elysia.
- 📡 **Lightweight Transport**: Uses SSE (Server-Sent Events) and BroadcastChannel for low-latency, proxy-friendly updates. No WebSocket complexity or lock-in.
- ⚛️ **React Ready**: First-class support for React with deep `useSyncExternalStore` integration.
- 🔌 **Thin Adapters**: Transparent, lightweight adapters for your favorite frameworks.

---

## 📦 Monorepo Packages

| Package | Purpose | Docs |
| :--- | :--- | :--- |
| **[`@iadev93/zuno`](./packages/zuno)** | Core state engine & sync primitives | [README](./packages/zuno/README.md) |
| **[`@iadev93/zuno-react`](./packages/zuno-react)** | React bindings & hooks | [README](./packages/zuno-react/README.md) |
| **[`@iadev93/zuno-angular`](./packages/zuno-angular)** | Angular bindings (Signals/Observables) | [README](./packages/zuno-angular/README.md) |
| **[`@iadev93/zuno-express`](./packages/zuno-express)** | Server adapter for Express | [README](./packages/zuno-express/README.md) |
| **[`@iadev93/zuno-elysia`](./packages/zuno-elysia)** | Server adapter for Elysia (Bun) | [README](./packages/zuno-elysia/README.md) |

---

## 🏎️ Quick Start

### 1. Define your store (Client)
```typescript
import { createZuno } from "@iadev93/zuno";

const zuno = createZuno({ batchSync: true });
export const counter = zuno.store("counter", () => 0);

// Use it anywhere!
await counter.set(v => v + 1);
```

### 2. Connect to React
```tsx
import { createZunoReact } from "@iadev93/zuno-react";

// Use the React-enhanced instance
const zuno = createZunoReact();
const counter = zuno.store("counter", () => 0);

function Counter() {
  const value = counter.use();
  return <button onClick={() => counter.set(v => v + 1)}>{value}</button>;
}
```

### 3. Connect to Angular
```typescript
import { Component, inject } from '@angular/core';
import { ZunoService } from '@iadev93/zuno-angular';

@Component({
  template: `{{ count() }} <button (click)="inc()">+</button>`
})
export class Counter {
  zuno = inject(ZunoService);
  store = this.zuno.store('counter', () => 0);
  count = this.store.asSignal();

  inc() { this.store.set(c => c + 1); }
}
```

### 4. Sync with Server (Express)
```typescript
import express from "express";
import { createZunoExpress } from "@iadev93/zuno-express";

const app = express();
const zuno = createZunoExpress();

app.get("/zuno/sse", zuno.sse);
app.post("/zuno/sync", zuno.sync);
app.get("/zuno/snapshot", zuno.snapshot);

app.listen(3000);
```

---

## 📖 Deep Dive

- [**Why Zuno?**](./docs/why-zuno.md) — The philosophy and "The Mental Shift".
- [**Architecture**](./ARCHITECTURE.md) — How Zuno works under the hood.
- [**Roadmap**](./ROADMAP.md) — Completed milestones and the path to production readiness.
- [**Changelog**](./CHANGELOG.md) — Project history and release notes.
- [**Conflict Resolution**](./docs/conflict-resolution.md) — Strategies for merging state.
- [**Protocol Truth Table**](./docs/protocol-truth-table.md) — Offline/Sync behavior matrix.
- [**Contributing**](./CONTRIBUTING.md) — How to help build Zuno.
- [**Code of Conduct**](./CODE_OF_CONDUCT.md) — Our community standards.
- [**Wire Protocol v1**](./docs/protocol-v1.md) — Language-agnostic synchronization specs.

---

## 🛠️ Development

This is a monorepo powered by **pnpm**.

See the [exercise guide](./exercise/README.md) for multi-framework sync, missed-event replay, and snapshot-fallback testing.

```bash
pnpm install
pnpm build
```

---

## 📄 License

MIT © [Ibrahim Aftab](https://github.com/ibrahimaftab)
