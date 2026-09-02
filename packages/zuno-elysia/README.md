# @iadev93/zuno-elysia

<p><b>Elysia adapter for Zuno.</b></p>

Provides seamless state synchronization for ElysiaJS (Bun) applications using native async generators.

---

```bash
pnpm add @iadev93/zuno-elysia
```

## Usage

```typescript
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { createZunoElysia } from '@iadev93/zuno-elysia'
import {
  createZunoConnectionGateway,
  createZunoServerState,
} from '@iadev93/zuno/server'

const app = new Elysia()
  .use(cors())
  
const server = createZunoServerState()
const gateway = createZunoConnectionGateway(server, {
  region: 'eu-west',
  heartbeatIntervalMs: 15_000,
  maxConnectionsPerPrincipal: 10,
})
const zuno = createZunoElysia({
  server,
  gateway,
  principal: (request) => authenticatedPrincipal(request),
  authorize: ({ request, action }) => {
    // Replace with your session, API-key, or tenant policy.
    return canAccessZuno(request, action)
  },
})

// Register Zuno handlers
app.get('/zuno/sse', zuno.sse)
app.post('/zuno/sync', zuno.sync)
app.get('/zuno/snapshot', zuno.snapshot)

app.listen(3002)
```

## API

### `createZunoElysia(options?)`

Returns an object containing the following handlers:

Each call creates isolated server state and a connection gateway by default. Pass `server` and `gateway` when several handlers must share one authoritative universe and connection policy. The returned object exposes them as `zuno.server` and `zuno.gateway`.

The optional `authorize` hook runs before SSE/snapshot reads and mutation writes. Returning `false` produces a `403 FORBIDDEN` response without reading or mutating server state.

#### `sse` (GET)
An async generator handler for Server-Sent Events. It automatically handles:
- Connection keep-alive and heartbeats.
- Reconnection logic via `last-event-id`.
- Initial state snapshots for fresh connections.
- Retained-event replay after short interruptions.
- Authoritative snapshot fallback when the requested replay range has expired.
- Bounded per-subscriber buffering through the selected server state's `maxSubscriberBuffer` option.
- Protocol v1 partition/topic subscription validation through authenticated principal metadata.
- Typed `RESYNC_REQUIRED` recovery when a gateway drains or evicts a slow consumer.

#### `sync` (POST)
Validates and applies a single state event or an ordered `{ events: [...] }`
batch. Processing stops at the first conflict; earlier accepted entries remain
committed and `conflictIndex` identifies the rejected entry. Accepted updates
are broadcast to connected clients.

#### `snapshot` (GET)
Returns the current full state of the universe, the current version, and the last event ID.

## Features
- **Native SSE**: Uses Elysia's optimized streaming capabilities with async generators.
- **Resilient Recovery**: Replays missed events when retained and falls back to an event-ID-bearing snapshot after a replay gap.
- **Backpressure Protection**: Disconnects subscribers that exceed the configured pending-message buffer so they can recover cleanly on reconnect.
- **Gateway Lifecycle**: Supports health reporting, regional registration, admission limits, and graceful draining.
- **Lightweight**: Zero runtime dependencies on Elysia itself (uses structural typing).
- **Type Safe**: Fully written in TypeScript with comprehensive docstrings.

## License
MIT
