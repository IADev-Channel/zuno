# Durable Authority and SQLite Operations

Milestone 10 makes the database, rather than a server process, authoritative.

Import the Node SQLite adapter from `@iadev93/zuno/server/sqlite`. It is isolated from the general server entry so Bun and other runtimes can use non-SQLite adapters without loading `node:sqlite`.

- Durable mutations are atomic state-and-log transactions. A version mismatch changes neither table.
- Idempotency keys are unique within a partition. Retrying a committed key returns the original event and does not publish it again.
- Deletes are durable tombstones. Their replay retention is configured independently from ordinary events so disconnected consumers can observe deletion.
- Compaction may remove replay entries by age and count, but never reconstructs or rewrites current materialized state.
- Presence and cursor traffic must use `durability: "ephemeral"`; it is live-only and cannot be recovered after disconnect.
- Event-bus offsets are monotonic per partition. Consumers commit an offset after local delivery and ignore offsets they have already consumed.
- A partition migration is an administrative, offline transaction: pause writes, copy state and retained events, preserve event/idempotency identity, verify counts, atomically change routing ownership, then resume. Conflicting destination keys abort the migration.
- If the bus fails after a database commit, clients recover from the durable replay log. A retry with the same idempotency key is safe.

## Mutation examples

Use a stable idempotency key for every retriable logical mutation:

```ts
const result = applyStateEvent({
  storeKey: "tenant-a:cart:item-1",
  state: { quantity: 2 },
  baseVersion: 0,
  idempotencyKey: "checkout-42:item-1",
}, server);
```

Reusing it in the same partition returns the original accepted event without
another state change or live publication.

Delete state with a replayable tombstone:

```ts
applyStateEvent({
  storeKey: "tenant-a:cart:item-1",
  state: null,
  operation: "delete",
  idempotencyKey: "delete:item-1",
}, server);
```

Send presence or cursor traffic without durable state or replay history:

```ts
applyStateEvent({
  storeKey: "tenant-a:presence:alice",
  state: { online: true },
  durability: "ephemeral",
}, server);
```

## Inspecting SQLite

```bash
sqlite3 ./data/zuno.sqlite
```

```sql
.headers on
.mode column
.tables
SELECT partition_key, store_key, state_json, version FROM zuno_state;
SELECT event_id, partition_key, topic, store_key, operation FROM zuno_events ORDER BY event_id;
SELECT partition_key, idempotency_key, event_id FROM zuno_idempotency;
```

An empty partition or topic represents a legacy unscoped key such as `counter`;
it is an empty string, not SQL `NULL`.

## Compaction

```ts
persistence.compact({
  maxEvents: 10_000,
  retentionMs: 7 * 24 * 60 * 60 * 1000,
  tombstoneRetentionMs: 30 * 24 * 60 * 60 * 1000,
});
```

Keep tombstones long enough for the maximum supported offline interval. A
client older than the retained replay range must recover from a snapshot.
