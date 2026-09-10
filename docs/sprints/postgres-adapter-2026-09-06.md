# PostgreSQL Adapter Sprint

## Sprint identity

- Adapter/category: PostgreSQL / database & durable storage
- Branch: `adapter/postgres-sprint-2026-09-06`
- Sprint dates: 2026-09-06 through 2026-09-12
- Status: blocked on prerequisite Core async-persistence milestone; PostgreSQL storage/transaction design completed Thursday

## Objective / expected outcome

Deliver a production-oriented PostgreSQL persistence adapter for Zuno that preserves the durable-authority semantics established by the SQLite reference: transactional compare-and-set state updates, partition-scoped idempotency, durable replay/event-log operations, snapshots/compaction, and restart-safe authoritative state.

The developer outcome is that teams already operating PostgreSQL can use it as Zuno's durable authority without introducing SQLite or building custom persistence.

## Rationale / user impact

PostgreSQL is a high-impact shared database target for multi-process Zuno deployments and pressure-tests whether the persistence boundary is truly database-neutral. This sprint does not add another adapter.

## Architecture and code impact

The existing `ZunoServerPersistence` contract is synchronous. `ZunoServerState` exposes synchronous persistence-backed reads, replay helpers, append, CAS and clear; `applyStateEvent()` is synchronous and performs a persisted read while materializing deltas before CAS. Production PostgreSQL clients are asynchronous, so PostgreSQL cannot correctly implement the current contract without blocking/event-loop hacks or false synchronous abstractions.

Senior-dev decision: do not broaden this adapter sprint into an unplanned Core API migration. PostgreSQL is blocked on a generic async-persistence Core milestone. Existing synchronous Memory/SQLite APIs must remain intact until a deliberate compatibility path exists.

### Minimum Core async-persistence prerequisite

The prerequisite should introduce a separate explicit async contract rather than changing existing method return types in place. A suitable capability boundary must provide Promise-based equivalents for:

- `getRecord(storeKey)`
- `getSnapshot(partition?, topics?)`
- `readEvents(query)`
- `getReplayBounds()`
- `appendEvent(event, maxEvents)`
- `compact(policy, now?)`
- `clear()`
- `compareAndSet(event, maxEvents)`

Core must then provide an async server execution path whose reads/replay/CAS delegate to that contract. Async mutation application must preserve validation and authorization behavior, await delta source-state reads, await durable CAS, and publish a durable event only after the persistence transaction has committed successfully. Duplicate idempotent mutations must not republish.

The prerequisite must not silently make current `ZunoServerState` methods or `applyStateEvent()` return Promises. Memory/SQLite users and current framework integrations need the existing synchronous path to remain source-compatible. The async path should be explicit in types/API naming or represented by a separate server type/factory so TypeScript prevents accidental sync/async mixing.

A remote persistence implementation must own lifecycle explicitly. Connection/pool initialization and shutdown cannot be hidden in generic browser/core entry points. Database-driver types/dependencies must remain server-only.

### Compatibility invariants

1. Existing Memory and SQLite persistence behavior remains synchronous and source-compatible.
2. The authoritative CAS result shape and version-conflict semantics remain equivalent across sync and async paths.
3. Event publication occurs after successful durable commit, never before it.
4. Failed/rejected CAS appends no replay event and changes no authoritative state.
5. Idempotency remains partition-scoped and duplicate retries return the original authoritative event without republishing.
6. Event IDs remain monotonically ordered for committed events and replay ordering is deterministic.
7. Delta mutation materialization uses the authoritative persisted record and cannot race through an un-awaited read.
8. Tombstone, replay-bound and compaction semantics remain persistence-neutral.
9. PostgreSQL/database dependencies cannot leak into browser or generic package entry points.
10. Async persistence failures reject explicitly; they must not be converted into apparent successful mutations.

### Core prerequisite acceptance tests

- Existing Memory/SQLite suites pass unchanged on the synchronous path.
- Compile-time/API test proves existing sync methods retain non-Promise return types.
- Async test persistence proves record/snapshot/replay operations are awaited correctly.
- Async CAS success commits state and event before publication.
- Async CAS conflict returns current authoritative record and produces no event/publication.
- Async CAS persistence rejection produces no publication.
- Async delta application awaits the authoritative record before materialization and CAS.
- Two concurrent CAS attempts from the same base version produce exactly one successful authoritative version transition.
- Concurrent retries with the same partition/idempotency key produce one durable event and one publication.
- Same idempotency key in different partitions remains independent.
- Replay after async commits is monotonically ordered and respects scope/limit semantics.
- Delete/tombstone and compaction behavior matches sync reference semantics.
- Async persistence initialization/disposal is deterministic and does not affect generic/browser bundles.
- Framework-facing async integration tests verify responses are not emitted before durable commit.

These tests are the gate for resuming PostgreSQL implementation; a type-only interface without the async server/application execution tests is insufficient.

## PostgreSQL adapter design

This design intentionally targets the proposed generic async contract and does not commit code against an unapproved Core API.

### Tables and indexes

Use a dedicated schema (default `public`, configurable later if justified) with three logical tables mirroring the persistence-neutral model rather than SQLite implementation details:

- `zuno_state(partition_key text, store_key text, state_json jsonb, version bigint, primary key(partition_key, store_key))`
- `zuno_events(event_id bigint generated by default as identity primary key, partition_key text, topic text, store_key text, operation text, created_at bigint, payload_json jsonb)`
- `zuno_idempotency(partition_key text, idempotency_key text, event_id bigint references zuno_events(event_id) on delete cascade, primary key(partition_key, idempotency_key))`

Indexes: `(partition_key, topic, event_id)` for scoped replay and an event-age/operation index only if retention profiling proves it useful. Avoid speculative indexes in V1. `version > 0` and operation `upsert|delete` constraints should match SQLite semantics. JSONB is preferred for validation/storage ergonomics, but payloads must round-trip as Zuno JSON values without PostgreSQL-specific query semantics leaking into Core.

### Bootstrap and lifecycle

The adapter owns or receives a server-only PostgreSQL pool. Initialization executes idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statements before the adapter is exposed as ready. Initialization must be explicit/awaitable; constructor side effects must not race first use. `close()`/`dispose()` only closes a pool the adapter owns; an injected external pool remains caller-owned. No `pg` import may appear in generic/browser entry points.

### Atomic compare-and-set transaction

Each CAS uses one checked-out client and one transaction.

1. `BEGIN`.
2. If `idempotencyKey` exists, check `(partition_key, idempotency_key)`. The unique primary key is the final concurrency authority; duplicate-key races are handled by re-reading the already committed authoritative event rather than producing a second event.
3. Lock the target state row with `SELECT ... FOR UPDATE` when it exists.
4. For an absent row, concurrent creation needs serialization. V1 should use a transaction-scoped PostgreSQL advisory lock derived deterministically from the full `storeKey` before re-reading the row. This avoids the classic two-writers-both-observe-missing race without creating placeholder state rows. The lock key function must be stable and collision-safe enough for correctness; if a collision occurs it may reduce concurrency but must not corrupt state.
5. Compare `baseVersion` against the locked authoritative version (`0` when absent). On mismatch, `ROLLBACK` and return `{ ok: false, current }`.
6. Compute next version. Upsert state with that version or delete the state row for tombstone operations.
7. Insert the event and obtain identity `event_id` with `RETURNING event_id`.
8. Build the authoritative event using that ID/version/timestamp and update/store its payload JSON.
9. Insert the partition-scoped idempotency mapping when present.
10. Apply bounded compaction inside the same transaction only when required by the existing persistence semantics.
11. `COMMIT`.
12. Return the authoritative event. Core publication occurs only after this Promise resolves successfully.

No state mutation/event/idempotency mapping may survive a failed transaction.

### Idempotency race strategy

The `(partition_key, idempotency_key)` primary key is authoritative. A pre-check is an optimization, not the concurrency guarantee. If two transactions race with the same idempotency key, only one mapping may commit. The loser must rollback its attempted state/event transaction, then outside that failed transaction read the winning mapping joined to `zuno_events` and return that authoritative event with `duplicate: true`. It must not publish. The same key in different partitions remains independent.

This behavior needs an integration test with genuinely concurrent connections; a sequential unit test is insufficient.

### Replay and event IDs

Replay uses `event_id > $after` plus optional partition/topic predicates, ordered by `event_id ASC`, with a parameterized limit. Identity/sequence values can contain gaps after rolled-back transactions; Zuno must require monotonic ordering, not gap-free IDs. Replay bounds use `MIN/MAX(event_id)` and return the same empty-log semantics as SQLite.

### Compaction and retention

Compaction preserves existing policy semantics: retention removes expired upserts, tombstone retention removes expired deletes, then `maxEvents` retains the newest event IDs. Deleting events cascades associated idempotency rows exactly as the SQLite foreign key does. V1 correctness is more important than optimizing a very large event log; performance-oriented chunked compaction can be a later measured improvement. Compaction called as part of CAS must use the same transaction/client, never acquire a second pool connection and accidentally escape atomicity.

### Snapshot and record reads

`getRecord` scopes by both parsed partition and full store key. `getSnapshot` optionally filters partition in SQL; topic filtering should also be SQL-side when topics are supplied to avoid transferring an entire partition unnecessarily. State/version conversion must guard against JavaScript unsafe integers if versions/event IDs can exceed `Number.MAX_SAFE_INTEGER`; V1 must either validate and fail explicitly at that boundary or establish a safe numeric contract before converting PostgreSQL `bigint` strings.

### Failure and retry policy

The persistence adapter must not silently retry an entire mutation after an ambiguous connection failure around `COMMIT`, because doing so can create uncertainty about whether the first transaction committed. Idempotency keys provide safe application-level retry when supplied. PostgreSQL serialization/deadlock errors may be candidates for bounded retry only if the operation can prove retry safety and the policy is explicit; V1 should prefer surfacing errors over hidden behavior.

### Packaging

Preferred package shape is a dedicated server adapter package (for example `@iadev93/zuno-postgres`) depending on Zuno's server persistence types plus `pg`, rather than adding `pg` to the universal core package. Exports must be server-only and tree/bundle checks must prove browser consumers do not resolve PostgreSQL or Node networking dependencies.

## Compatibility and regression risks

Primary risk is API propagation. A partial Promise-aware implementation could create races, publish before commit, or silently change framework behavior. PostgreSQL-specific risks are concurrent absent-row CAS, concurrent idempotency, transaction/commit ambiguity, replay identity gaps, bigint conversion, JSON serialization, startup/schema races, lifecycle ownership, pool exhaustion, compaction cost, and driver bundling boundaries.

## Weekly task breakdown

### Sunday — planning
- [x] Inspect roadmap/package inventory and confirm PostgreSQL is not duplicated.
- [x] Create sprint branch and source-of-truth document.
- [x] Define scope, risks, QA strategy, and deadline assessment.

### Monday — contract review
- [x] Inspect persistence interface and SQLite implementation.
- [x] Identify synchronous persistence as a hard PostgreSQL blocker.
- [x] Avoid throwaway adapter skeleton/blocking hacks.

### Tuesday — architecture checkpoint
- [x] Trace async propagation through server state, mutation application, tooling and tests.
- [x] Determine a small adapter-local extension is not safe.
- [x] Formally block PostgreSQL on a dedicated Core milestone.

### Wednesday — blocker specification
- [x] Specify minimum generic async-persistence operations.
- [x] Define sync compatibility and publish-after-commit invariants.
- [x] Define acceptance-test gate for the Core prerequisite.

### Thursday — adapter design while blocked
- [x] Define PostgreSQL tables/indexes and lifecycle/bootstrap strategy.
- [x] Define transactional CAS including absent-row concurrency control.
- [x] Define partition-scoped idempotency race behavior.
- [x] Define replay/event-ID, compaction, failure and packaging semantics.

### Friday — QA/design review
- [ ] Review Core prerequisite and PostgreSQL design for races, idempotency, replay, lifecycle and packaging risks.
- [ ] Turn design risks into explicit PostgreSQL integration-test scenarios.

### Saturday — blocker closeout
- [ ] Finalize prerequisite milestone and sprint report.
- [ ] Do not publish a fake/unsafe PostgreSQL adapter.
- [ ] Do not create an implementation PR unless prerequisite becomes valid and verified.
- [ ] Do not merge a PR.

## Daily progress log

### Sunday — 2026-09-06
Planning completed. PostgreSQL selected as the first additional persistence adapter. No implementation changes by design.

### Monday — 2026-09-07
Reviewed the persistence contract and SQLite reference. Confirmed the interface is synchronous and PostgreSQL cannot correctly satisfy it using normal production clients. Deferred a cosmetic skeleton.

### Tuesday — 2026-09-08
Traced the synchronous assumption through `ZunoServerState`, `applyStateEvent()`, benchmarks/capacity tooling and tests. Concluded a generic remote-database path requires explicit async server/application APIs. PostgreSQL formally blocked on a Core prerequisite.

### Wednesday — 2026-09-09
Specified the prerequisite contract and acceptance gate. The recommended compatibility shape is an explicit Promise-based persistence/server path alongside the existing synchronous path, not a union-return interface and not an in-place Promise migration. Defined ten behavioral invariants covering commit/publication ordering, CAS, idempotency, replay, delta materialization, failures, tombstones and package boundaries. Defined acceptance tests including concurrent CAS/idempotency races and compile-time sync compatibility. This makes the blocker implementation-ready enough for Thursday's PostgreSQL storage design without prematurely approving a Core API surface.

### Thursday — 2026-09-10
Completed the PostgreSQL storage design against the proposed async contract. The design mirrors Zuno's persistence-neutral state/event/idempotency model using PostgreSQL JSONB and identity event IDs. CAS is a single transaction with row locking plus a deterministic advisory lock for the absent-row creation race. Partition/idempotency uniqueness is the concurrency authority; duplicate-key races rollback the losing mutation and return the winning authoritative event without publication. Replay explicitly tolerates sequence gaps while preserving monotonic ordering. Compaction stays on the same transaction/client. Lifecycle is explicit and pool ownership is defined. Packaging is isolated to a server-only adapter package so `pg` cannot leak into browser/core bundles. Flagged bigint conversion and ambiguous commit failures as explicit V1 design/test concerns. No adapter code was written because the Core async prerequisite remains unsatisfied.

## QA / test checklist

- [x] Existing persistence contract reviewed against PostgreSQL execution model.
- [x] SQLite atomicity/reference implementation reviewed.
- [x] Persistence call-site propagation through server state reviewed.
- [x] Durable mutation path reviewed for async impact.
- [x] Tooling/tests reviewed for synchronous assumptions.
- [x] Core async-persistence compatibility acceptance tests specified.
- [x] PostgreSQL schema/transaction/idempotency/replay/compaction design specified.
- [ ] Existing SQLite persistence tests remain green after future Core changes.
- [ ] PostgreSQL schema/bootstrap deterministic and repeatable.
- [ ] Round-trip JSON state.
- [ ] Atomic CAS/version conflict behavior.
- [ ] Concurrent absent-row CAS produces one valid version transition.
- [ ] Rejected mutation appends no event.
- [ ] Partition-scoped idempotency and concurrent retry safety.
- [ ] Tombstone/replay/retention semantics.
- [ ] Restart recovery and replay ordering including sequence gaps.
- [ ] Failure rollback preserves state/log consistency.
- [ ] Commit ambiguity behavior documented/tested.
- [ ] Bigint safe-range behavior defined/tested.
- [ ] Pool ownership and disposal deterministic.
- [ ] PostgreSQL dependency absent from browser/generic entry points.
- [ ] Type declarations/package exports build correctly.
- [ ] Full repository verification passes.

## CI status

No implementation code exists, so adapter PR CI is not applicable. Documentation-only architecture work must not be represented as adapter validation.

## Documentation / versioning status

Sprint source-of-truth updated through Thursday. No README/API/version changes are justified because no supported adapter API exists yet.

## Blockers

**Confirmed architectural blocker:** the server persistence/application chain is synchronous while production PostgreSQL I/O is asynchronous. Resolution requires a generic Core async-persistence/server capability with the acceptance gate specified above.

## Deadline assessment

A production PostgreSQL adapter by Saturday is **not realistic under senior-dev/QA standards without the Core prerequisite**. The PostgreSQL storage design is now implementation-ready at the persistence layer, but implementation remains gated by the Core async execution path.

## Final outcome

Pending Saturday closeout. As of Thursday, PostgreSQL remains correctly blocked; both the Core prerequisite and PostgreSQL storage/transaction design are now specified.