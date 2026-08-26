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
import { createZunoServerState } from "@iadev93/zuno/server";

const app = express();
app.use(express.json());

const server = createZunoServerState();
const zuno = createZunoExpress({
  server,
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

Each call creates isolated server state by default. Pass `server` when several routers or custom endpoints must share the same authoritative universe. The returned object exposes the selected instance as `zuno.server`.

The optional `authorize` hook runs before SSE/snapshot reads and mutation writes. Returning `false` produces a `403 FORBIDDEN` response without reading or mutating server state.

#### `sse` (GET)
Handles persistent SSE connections, heartbeats, and initial synchronization.

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
