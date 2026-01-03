# @iadev93/zuno-express

Express adapter for **Zuno**.

Provides server‑side synchronization endpoints using Server‑Sent Events (SSE).

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
import { createZuno } from "@iadev93/zuno";

const app = express();
const zuno = createZuno();

createZunoExpress(app, { zuno });

app.listen(3000);
```

---

## What It Provides

* SSE endpoint for state sync
* Snapshot delivery
* Version‑safe event ingestion

---

## What It Does NOT Do

* No WebSockets
* No framework‑specific state
* No persistence layer

---

## License

MIT
