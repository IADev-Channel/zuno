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

const app = express();
app.use(express.json());

const zuno = createZunoExpress();

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
