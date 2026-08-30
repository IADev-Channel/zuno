# Zuno React Tutorial

This exercise demonstrates the `@iadev93/zuno-react` adapter, React hooks,
middleware, conflict resolution, batching, and durable offline synchronization.

## What you will build

- A synchronized counter.
- A synchronized todo list.
- React components that rerender only when their selected store state changes.
- A console logger middleware showing each mutation and transport result.

The client shares the Elysia universe on port `3002` with the Basic HTML and
Angular exercises.

## Run it

From the repository root:

```bash
pnpm install
pnpm start-elysia
```

In another terminal:

```bash
pnpm start-react
```

Production build:

```bash
pnpm --filter exercise-react build
```

## Files

- `App.tsx`: Zuno client, stores, and React components.
- `logger.ts`: onion-style Zuno middleware.
- `index.tsx`: React root bootstrap.
- `App.css`: visual styling.
- `tsconfig.json`: React and workspace package resolution.

## Creating a React-enabled client

```ts
const z = createZunoReact({
  channelName: "zuno-demo",
  sseUrl: "http://localhost:3002/zuno/sse",
  syncUrl: "http://localhost:3002/zuno/sync",
  optimistic: true,
  batchSync: true,
  offlineQueue: createIndexedDBOfflineQueue({
    databaseName: "zuno-exercises",
    queueKey: "react",
  }),
  middleware: [loggerMiddleware],
  resolveConflict: (_local, server) => server,
});
```

The server-wins resolver makes conflict behavior explicit: if another client
advanced the version first, this client accepts the returned server state.

## Stores and hooks

Stores are created outside React components so every component uses the same
store instance:

```ts
const counter = z.store("counter", () => 0);
const todos = z.store<Todo[]>("todos", () => []);
```

Inside a component, `.use()` subscribes through React's external-store API:

```tsx
const Counter = () => {
  const count = counter.use();
  return <button onClick={() => counter.set((c) => c + 1)}>{count}</button>;
};
```

`.use(selector, equalityFn)` can select a smaller derived value when a component
does not need the complete store.

## Middleware

`loggerMiddleware` wraps dispatch:

```ts
export const loggerMiddleware: Middleware =
  (api) => (next) => async (event) => {
    console.log("before", api.universe.snapshot());
    const result = await next(event);
    console.log("after", api.universe.snapshot(), result);
    return result;
  };
```

Middleware can add logging, metrics, validation, tracing, or application-specific
policy without changing components.

## Synchronization features

- Optimistic rendering keeps interaction immediate.
- `baseVersion` protects against stale overwrites.
- SSE distributes accepted authoritative state.
- BroadcastChannel speeds up same-origin tab synchronization.
- IndexedDB retains offline mutations across reloads.
- Per-store coalescing sends only the final queued state on reconnect.
- Batching combines repeated synchronous writes.

## Exercises to try

1. Open React and Angular together and edit the same stores.
2. Inspect logger middleware output in the browser console.
3. Go offline, perform multiple counter changes, reload, then reconnect.
4. Trigger a conflict by changing the same store from two clients.
5. Replace server-wins with a custom merge resolver.
6. Use a selector such as `todos.use((items) => items.length)`.

See the [core client guide](../../packages/zuno/README.md),
[conflict-resolution guide](../../docs/conflict-resolution.md), and
[exercise overview](../README.md).
