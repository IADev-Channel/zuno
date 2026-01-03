# Zuno

**Zuno** is a universal, event‑driven state system designed to keep **client, server, and multiple runtimes** in sync with strong consistency guarantees.

Zuno is built around a simple idea:

> State is not local — it is *distributed, versioned, and observable*.

---

## Monorepo Packages

This repository contains three packages:

| Package               | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `@iadev93/zuno`         | Core state engine, sync primitives, and adapter contracts |
| `@iadev93/zuno-react`   | React adapter using `useSyncExternalStore`                |
| `@iadev93/zuno-express` | Express adapter (SSE + sync endpoints)                    |

---

## Why Zuno?

* Deterministic state updates (versioned events)
* Cross‑tab, cross‑client synchronization
* SSE‑based transport (no WebSocket lock‑in)
* Framework‑agnostic core
* Thin, explicit adapters (React / Express today)

Zuno is **not** Redux, Zustand, or TanStack Query.
It is a **state synchronization system**.

---

## Installation

```bash
npm install @iadev93/zuno
```

Adapters:

```bash
npm install @iadev93/zuno-react
npm install @iadev93/zuno-express
```

---

## Development

```bash
npm install
npm run build
```

---

## Status

* Core: ✅ Stable
* React Adapter: ✅ Stable
* Express Adapter: ✅ Stable
* DevTools: 🚧 Planned

---

## License

MIT
