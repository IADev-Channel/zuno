# Server Persistence and Multi-Process Operation

Zuno server instances separate authoritative storage from live event delivery:

- `ZunoServerPersistence` owns current state and replay through granular record,
  snapshot, replay, append, and compaction operations.
- `ZunoServerEventBus` fans accepted authoritative events out to other server
  instances so their connected SSE clients receive live updates.

Every process serving the same namespace must use the same persistence backend
and shared event bus.

## Atomic compare-and-set requirement

`ZunoServerPersistence.compareAndSet()` is the authoritative write boundary. An
implementation must perform these operations atomically:

1. Read the current record for `storeKey`.
2. Compare the mutation's `baseVersion` with the current version.
3. Reject a mismatch without changing state or the replay log.
4. Deduplicate a supplied idempotency key within its partition.
5. Assign the next store version and event ID.
6. Update state and append/compact the replay log in one commit.

This requirement prevents two processes from both accepting mutations based on
the same version. A database adapter should implement it with a transaction,
conditional update, or equivalent compare-and-swap primitive.

## In-memory shared authority

The in-memory adapters are useful for tests and multiple server instances in one
runtime:

```ts
import {
  createMemoryZunoServerEventBus,
  createMemoryZunoServerPersistence,
  createZunoServerState,
} from "@iadev93/zuno/server";

const persistence = createMemoryZunoServerPersistence();
const eventBus = createMemoryZunoServerEventBus();

const serverA = createZunoServerState({ persistence, eventBus });
const serverB = createZunoServerState({ persistence, eventBus });
```

These adapters do not cross an operating-system process boundary.

## SQLite production authority

```ts
import { createZunoServerState } from "@iadev93/zuno/server";
import { createSQLiteZunoServerPersistence } from "@iadev93/zuno/server/sqlite";

const persistence = createSQLiteZunoServerPersistence("./data/zuno.sqlite");
const server = createZunoServerState({ persistence });
```

The adapter creates missing parent directories and uses SQLite WAL transactions
and constraints for state/version updates, event append, and idempotency. Close
it during graceful shutdown with `persistence.close()`.

`node:sqlite` requires Node.js 22 or newer. Bun does not currently provide that
built-in module; use the file adapter or another Bun-compatible adapter there.
SQLite is suitable for a single authority host. Distributed deployments should
use a shared transactional database and shared event bus.

## Durable file reference adapter

The file adapter demonstrates restart-safe persistence and cross-process atomic
writes for a single host:

```ts
import {
  createFileZunoServerPersistence,
  createZunoServerState,
} from "@iadev93/zuno/server";

const server = createZunoServerState({
  persistence: createFileZunoServerPersistence("./data/zuno.json"),
});
```

It writes a temporary JSON document and atomically renames it into place while
holding a lock directory. Abandoned locks expire, allowing another process to
recover after a crash. The adapter is a reference implementation for modest
single-host workloads, not a replacement for a transactional database.

Call `server.dispose()` during shutdown to unsubscribe the instance from its
event bus and release local listeners.

See [Durable authority](./durable-authority.md) for idempotency, tombstones,
retention, ephemeral events, offsets, recovery, inspection, and migration rules.
