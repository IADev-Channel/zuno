# @iadev93/zuno-express

<p><b>Express adapter for Zuno.</b></p>

Provides server-side synchronization endpoints using Server-Sent Events (SSE) for Express applications.

---

## Install

```bash
npm install @iadev93/zuno-express
```

Peer dependency:
* `express >= 4`

---

## Usage

```ts
import express from "express";
import { createZunoExpress } from "@iadev93/zuno-express";
import {
  createZunoConnectionGateway,
  createZunoServerState,
} from "@iadev93/zuno/server";

const app = express();
app.use(express.json());

const server = createZunoServerState();
const gateway = createZunoConnectionGateway(server, {
  region: "eu-west",
  heartbeatIntervalMs: 15_000,
  maxConnectionsPerPrincipal: 10,
});
const zuno = createZunoExpress({
  server,
  gateway,
  principal: (request) => ({
    id: request.user.id,
    partitions: request.user.partitions,
    topics: request.user.topics,
  }),
  authorize: ({ request, action }) => {
    // Replace with your session, API-key, or tenant policy.
    return Boolean(request.user) && (action === "read" || request.user.canWrite);
  },
});

// Unified handlers
app.get("/zuno/sse", zuno.sse);
app.post("/zuno/sync", zuno.sync);
app.get("/zuno/snapshot", zuno.snapshot);

app.listen(3000);
```

---

## API

### `createZunoExpress(opts?)`

Returns an object containing the following Express handlers:

Each call creates isolated server state and a connection gateway by default. Pass `server` and `gateway` when several routers or custom endpoints must share the same authoritative universe and connection limits. The returned object exposes them as `zuno.server` and `zuno.gateway`.

The optional `authorize` hook runs before SSE/snapshot reads and mutation writes. Returning `false` produces a `403 FORBIDDEN` response without reading or mutating server state.

#### `sse` (GET)
Hands the persistent SSE connection to the selected gateway. The gateway owns heartbeats, admission, subscription routing, bounded backpressure, and graceful draining. Reconnecting clients receive retained events after their last event ID; if that replay range is incomplete—or a slow consumer receives `RESYNC_REQUIRED`—the client recovers from an authoritative snapshot.

#### `sync` (POST)
Validates and applies incoming state events.

#### `snapshot` (GET)
Returns the current full state of the universe.

---

## What It Does NOT Do

* No WebSockets
* No framework‑specific state
* No persistence layer

---

If you’re using Zuno in a real project, please open an issue and tell us your use case.

---

## License

MIT
