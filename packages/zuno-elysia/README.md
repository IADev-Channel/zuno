# @iadev93/zuno-elysia

Elysia adapter for [Zuno](https://github.com/iadev93/zuno), providing seamless state synchronization for ElysiaJS applications.

## Installation

```bash
pnpm add @iadev93/zuno-elysia
```

## Usage

```typescript
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { createZunoElysia } from '@iadev93/zuno-elysia'

const app = new Elysia()
  .use(cors())
  
const zuno = createZunoElysia()

// Register Zuno handlers
app.get('/zuno/sse', zuno.sse)
app.post('/zuno/sync', zuno.sync)
app.get('/zuno/snapshot', zuno.snapshot)

app.listen(3002)
```

## API

### `createZunoElysia()`

Returns an object containing the following handlers:

#### `sse` (GET)
An async generator handler for Server-Sent Events. It automatically handles:
- Connection keep-alive and heartbeats.
- Reconnection logic via `last-event-id`.
- Initial state snapshots for fresh connections.

#### `sync` (POST)
Validates and applies incoming state events to the Zuno universe. Handles version conflicts and broadcasts updates to all connected SSE clients.

#### `snapshot` (GET)
Returns the current full state of the universe, the current version, and the last event ID.

## Features
- **Native SSE**: Uses Elysia's optimized streaming capabilities with async generators.
- **Lightweight**: Zero runtime dependencies on Elysia itself (uses structural typing).
- **Type Safe**: Fully written in TypeScript with comprehensive docstrings.

## License
MIT
