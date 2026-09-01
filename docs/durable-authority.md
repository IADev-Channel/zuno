# Durable authority policy

Milestone 10 makes the database, rather than a server process, authoritative.

- Durable mutations are atomic state-and-log transactions. A version mismatch changes neither table.
- Idempotency keys are unique within a partition. Retrying a committed key returns the original event and does not publish it again.
- Deletes are durable tombstones. Their replay retention is configured independently from ordinary events so disconnected consumers can observe deletion.
- Compaction may remove replay entries by age and count, but never reconstructs or rewrites current materialized state.
- Presence and cursor traffic must use `durability: "ephemeral"`; it is live-only and cannot be recovered after disconnect.
- Event-bus offsets are monotonic per partition. Consumers commit an offset after local delivery and ignore offsets they have already consumed.
- A partition migration is an administrative, offline transaction: pause writes, copy state and retained events, preserve event/idempotency identity, verify counts, atomically change routing ownership, then resume. Conflicting destination keys abort the migration.
- If the bus fails after a database commit, clients recover from the durable replay log. A retry with the same idempotency key is safe.
