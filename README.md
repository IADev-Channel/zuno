<div align="center">
  <img src="https://raw.githubusercontent.com/IADev-Channel/zuno/main/assets/zuno-logo.png" alt="Zuno Logo" width="120" />
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
| **[`@iadev93/zuno-react`](./packages/zuno-react)** | React hooks & state bindings | [README](./packages/zuno-react/README.md) |
| **[`@iadev93/zuno-express`](./packages/zuno-express)** | Server adapter for Express | [README](./packages/zuno-express/README.md) |
| **[`@iadev93/zuno-elysia`](./packages/zuno-elysia)** | Server adapter for Elysia (Bun) | [README](./packages/zuno-elysia/README.md) |

---

## 🏎️ Quick Start

### 1. Define your store (Client)
```typescript
import { createZuno } from "@iadev93/zuno";

const zuno = createZuno();
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

### 3. Sync with Server (Express)
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
- [**Wire Protocol v1**](./docs/protocol-v1.md) — Language-agnostic synchronization specs.

---

## 🛠️ Development

This is a monorepo powered by **pnpm**.

```bash
pnpm install
pnpm build
```

---

## 📄 License

MIT © [Ibrahim Aftab](https://github.com/ibrahimaftab)
