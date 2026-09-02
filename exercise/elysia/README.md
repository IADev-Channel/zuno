# Zuno Elysia Server Tutorial

This is the main authoritative server for the browser exercises. It demonstrates
the Elysia adapter, SSE, versioned mutation handling, replay generation,
authorization-ready handlers, and durable server persistence.

## Run it

The exercise uses Bun:

```bash
pnpm start-elysia
```

It listens on `http://localhost:3002`.

Production build:

```bash
pnpm --filter exercise-elysia build
```

## Files and storage

- `app.ts`: server creation, Zuno routes, and replay helpers.
- `.data/zuno.json`: generated authoritative state and replay log.
- `package.json`: Bun start command and tsup production build.

`.data` is ignored by Git. Stop the server and delete that directory to reset
the demo universe.

## Creating durable server authority

```ts
const server = createZunoServerState({
  persistence: createFileZunoServerPersistence("./.data/zuno.json"),
});

const zuno = createZunoElysia({ server });
```

`ZunoServerPersistence` stores:

- the latest state/version for every store;
- retained authoritative events used for SSE replay;
- the next globally assigned event ID.

The file adapter performs version comparison, state update, event-ID assignment,
and replay append atomically under a cross-process lock.

## Mounting adapter handlers

```ts
.get("/zuno/sse", zuno.sse)
.post("/zuno/sync", zuno.sync)
.get("/zuno/snapshot", zuno.snapshot)
```

Routes:

- `GET /zuno/sse`: initial snapshot, missed-event replay, then live events.
- `POST /zuno/sync`: validates and atomically applies a proposed mutation.
- `GET /zuno/snapshot`: returns current authoritative state and event position.

CORS is enabled for the browser exercises running on Vite development origins.
Use a restricted origin list and the adapter's `authorize` hook in production.

## Replay exercise route

`POST /zuno/replay/:count/:operation?` generates between 1 and 100 authoritative
counter events. It reads the current version and calls `applyStateEvent()` for
each update.

```bash
curl -X POST http://localhost:3002/zuno/replay/5
curl -X POST http://localhost:3002/zuno/replay/5/decrement
```

Disconnect a browser first to test retained replay. Configure a smaller
`maxEvents` value and generate more events than it retains to test snapshot
fallback.

## Direct authoritative mutation route

`GET /zuno/counter/:value` demonstrates a server-originated state event:

```bash
curl http://localhost:3002/zuno/counter/42
```

Connected browsers receive the accepted event through SSE.

## Production extension points

- Pass `authorize` to protect reads and writes.
- Replace file persistence with a Bun-compatible transactional database adapter.
- Provide a shared `ZunoServerEventBus` for multiple server processes.
- Set tenant-specific server instances through trusted routing context.
- Configure state, replay, and subscriber-buffer limits.

See [server persistence](../../docs/server-persistence.md),
[Protocol v1](../../docs/protocol-v1.md), and the
[Elysia adapter README](../../packages/zuno-elysia/README.md).
