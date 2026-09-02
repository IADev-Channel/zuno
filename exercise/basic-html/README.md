# Zuno Basic HTML Tutorial

This exercise shows how to use Zuno without a UI framework. It is the smallest
browser example and a good place to learn the core store and synchronization
APIs before moving to React or Angular.

## What you will build

The page contains two synchronized stores:

- `counter`: a number changed with increment/decrement buttons.
- `todos`: an array supporting add, toggle, delete, and date sorting.

The client connects to the server selected in `exercise/config.ts`, synchronizes
with other browser examples, and persists unsent offline mutations in IndexedDB.

## Prerequisites

From the monorepo root, install dependencies and start the default Express server:

```bash
pnpm install
pnpm start-express
```

In another terminal, start this exercise:

```bash
pnpm start-html
```

Open the URL printed by Vite.

## Files

- `index.html`: static page structure and element IDs.
- `script.ts`: Zuno configuration, stores, subscriptions, and DOM events.
- `style.css`: presentation only; it has no effect on synchronization.
- `tsconfig.json`: browser TypeScript configuration.

## Creating the Zuno client

`script.ts` calls `createZuno()` once:

```ts
import { ZUNO_SERVER_URL } from "../config";

const zuno = createZuno({
  channelName: "zuno-todos",
  sseUrl: `${ZUNO_SERVER_URL}/zuno/sse`,
  syncUrl: `${ZUNO_SERVER_URL}/zuno/sync`,
  optimistic: true,
  batchSync: true,
  offlineQueue: createIndexedDBOfflineQueue({
    databaseName: "zuno-exercises",
    queueKey: "basic-html",
  }),
});
```

Features used:

- `optimistic`: updates the local UI before the server responds.
- `batchSync`: coalesces same-microtask changes to reduce requests.
- SSE: receives authoritative server events and recovery snapshots.
- BroadcastChannel: synchronizes same-origin tabs immediately.
- IndexedDB queue: retains mutations across offline reloads.

## Creating and using stores

Create a keyed store with an initializer:

```ts
const counter = zuno.store("counter", () => 0);
```

Subscribe to state and update the DOM:

```ts
counter.subscribe((value) => {
  counterEl.textContent = String(value);
});
```

Functional updates receive the latest local state:

```ts
counter.set((value) => value + 1);
```

The todo store uses the same API with a TypeScript type:

```ts
const todos = zuno.store<Todo[]>("todos", () => []);
```

## State flow

1. A DOM event calls `store.set()`.
2. Zuno applies the optimistic state locally.
3. Same-origin tabs receive the event through BroadcastChannel.
4. Zuno proposes the mutation to `/zuno/sync` with `baseVersion`.
5. The Elysia server atomically accepts it or returns a conflict.
6. All connected clients receive the authoritative event through SSE.

While offline, repeated changes to the same store are reduced to its final state
before flushing. Different store keys remain separate.

## Try the features

1. Open this exercise in two tabs and change the counter.
2. Open the React or Angular exercise and verify cross-framework sync.
3. Switch DevTools Network to Offline and create several changes.
4. Reload while offline, return online, and verify the latest states reach the server.
5. Inspect `zuno-exercises` in DevTools → Application → IndexedDB.

## Adapting this example

Replace the counter/todo types and render functions with your own domain state.
Keep store keys stable across clients, use JSON-serializable state, and assign a
queue key that is unique per application namespace or authenticated user.

See [Protocol v1](../../docs/protocol-v1.md) and the
[exercise overview](../README.md) for recovery and conflict details.
