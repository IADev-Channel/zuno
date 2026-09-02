# Zuno Raw Node HTTP Tutorial

This exercise shows the lowest-level Node.js integration without Express,
Elysia, or another web framework. It is useful for understanding exactly what
the Zuno server helpers do and for adapting Zuno to another HTTP runtime.

## Run it

```bash
pnpm start-http-server
```

The server listens on `http://localhost:3000`.

## File

`index.ts` creates a standard `node:http` server, adds CORS headers, routes
requests manually, and passes Node request/response objects to Zuno helpers.

## Routes

- `GET /zuno/sse`: opens the SSE stream with `createSSEConnection()`.
- `POST /zuno/sync`: parses and applies mutations with `setUniverseState()`.
- `GET /zuno/listing`: returns the snapshot with `sendSnapshot()`.
- `GET /zuno/counter/:value`: creates a server-originated event.
- `OPTIONS *`: returns the CORS preflight response.

Try it:

```bash
curl http://localhost:3000/zuno/listing

curl -X POST http://localhost:3000/zuno/sync \
  -H "Content-Type: application/json" \
  -d '{"storeKey":"counter","state":1,"baseVersion":0}'

curl http://localhost:3000/zuno/counter/10
```

Watch SSE events in another terminal:

```bash
curl -N http://localhost:3000/zuno/sse
```

## Low-level helper responsibilities

### `createSSEConnection(req, res, headers, server?)`

- Writes SSE response headers.
- Reads `Last-Event-ID` or `lastEventId`.
- Sends retained events or an authoritative snapshot.
- Buffers live events under backpressure.
- Sends heartbeats and cleans up closed connections.

### `setUniverseState(req, res, server?)`

- Bounds and parses the JSON request body.
- Validates the state event.
- Applies atomic version conflict rules.
- Returns `200`, `400`, `409`, or `413` as appropriate.

### `sendSnapshot(req, res, server?)`

Returns the current authoritative universe and replay position.

### `applyStateEvent(event, server?)`

Allows trusted server code to create an authoritative mutation through the same
validation, versioning, persistence, replay, and fan-out path.

## SQLite persistence

The exercise creates one SQLite-backed server and passes it to every helper:

```ts
const zunoServer = createZunoServerState({
  persistence: createSQLiteZunoServerPersistence("./.data/zuno.sqlite"),
});

createSSEConnection(req, res, headers, zunoServer);
setUniverseState(req, res, zunoServer);
sendSnapshot(req, res, zunoServer);
```

Using the same instance for every route is essential. Stop and restart the
exercise to confirm state and replay survive. Inspect the database with
`sqlite3 exercise/http-server/.data/zuno.sqlite`. For multiple processes, all
instances must share authoritative persistence and an event bus.

See [server persistence](../../docs/server-persistence.md) and
[Protocol v1](../../docs/protocol-v1.md).
