# Zuno Express Server Tutorial

This exercise demonstrates the Express adapter with granular route mounting,
durable authoritative state, JSON/CORS middleware, and server-originated events.
It runs independently from the Elysia/browser-demo universe.

## Run it

```bash
pnpm start-express
```

The server listens on `http://localhost:3003`.

Production build:

```bash
pnpm --filter exercise-express build
```

## Files and storage

- `app.ts`: Express middleware, persistence, Zuno handlers, and custom route.
- `.data/zuno.sqlite`: generated SQLite authority and retained replay events.
- `tsconfig.json`: Node/Express TypeScript configuration.

The `.data` directory is ignored. Stop the server and delete it to reset this
exercise without affecting Elysia.

## Express and Zuno setup

Express must parse JSON before the sync handler:

```ts
const app = express();
app.use(express.json());
app.use(cors());
```

Create durable authority and pass it to the adapter:

```ts
const server = createZunoServerState({
  persistence: createSQLiteZunoServerPersistence("./.data/zuno.sqlite"),
});

const zuno = createZunoExpress({ server });
```

## Mounting routes

The exercise uses granular handlers:

```ts
app.get("/zuno/sse", zuno.sse);
app.get("/zuno/snapshot", zuno.snapshot);
app.post("/zuno/sync", zuno.sync);
```

For default paths, the equivalent shortcut is:

```ts
zuno.mount(app);
```

The returned `zuno.server` is the same authoritative instance used by all three
handlers, so custom routes can safely share its state and replay log.

## Server-originated events

The custom counter route demonstrates applying an event outside the adapter's
HTTP sync handler:

```bash
curl http://localhost:3003/zuno/counter/25
```

It calls `applyStateEvent(..., zuno.server)`. Accepted events receive an
authoritative version/event ID, persist to disk, and publish to SSE subscribers.

## Features demonstrated

- Express JSON and CORS integration.
- Granular and convenience route mounting.
- Isolated `ZunoServerState` ownership.
- Durable restart-safe SQLite persistence using WAL transactions.
- Atomic version conflict detection.
- Retained SSE replay and snapshot fallback.
- Direct server-side authoritative mutations.

## Production extension points

- Configure `authorize` for request-level read/write policy.
- Restrict CORS instead of using the permissive demo default.
- Replace SQLite with PostgreSQL or another transactional store for distributed deployment.
- Add a shared event bus when running multiple Express processes.
- Route tenants to separate server states/persistence namespaces.

See [server persistence](../../docs/server-persistence.md),
[Protocol v1](../../docs/protocol-v1.md), and the
[Express adapter README](../../packages/zuno-express/README.md).
