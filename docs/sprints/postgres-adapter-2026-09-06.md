# PostgreSQL Adapter Sprint

## Sprint identity

- Adapter/category: PostgreSQL / database & durable storage
- Branch: `adapter/postgres-sprint-2026-09-06`
- Sprint dates: 2026-09-06 through 2026-09-12
- Status: blocked on prerequisite Core async-persistence milestone; prerequisite contract specified Wednesday

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

## Compatibility and regression risks

Primary risk is API propagation. A partial Promise-aware implementation could create races, publish before commit, or silently change framework behavior. PostgreSQL-specific risks remain transaction boundaries, concurrent CAS/idempotency, replay ordering, JSON serialization, startup/schema races, lifecycle management, and driver bundling boundaries.

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
- [ ] Define PostgreSQL schema, transaction/CAS, idempotency, replay and compaction strategy against the proposed generic contract without committing implementation to an unapproved API.

### Friday — QA/design review
- [ ] Review Core prerequisite and PostgreSQL design for races, idempotency, replay, lifecycle and packaging risks.

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

## QA / test checklist

- [x] Existing persistence contract reviewed against PostgreSQL execution model.
- [x] SQLite atomicity/reference implementation reviewed.
- [x] Persistence call-site propagation through server state reviewed.
- [x] Durable mutation path reviewed for async impact.
- [x] Tooling/tests reviewed for synchronous assumptions.
- [x] Core async-persistence compatibility acceptance tests specified.
- [ ] Existing SQLite persistence tests remain green after future Core changes.
- [ ] PostgreSQL schema/bootstrap deterministic and repeatable.
- [ ] Round-trip JSON state.
- [ ] Atomic CAS/version conflict behavior.
- [ ] Rejected mutation appends no event.
- [ ] Partition-scoped idempotency and concurrent retry safety.
- [ ] Tombstone/replay/retention semantics.
- [ ] Restart recovery and replay ordering.
- [ ] Failure rollback preserves state/log consistency.
- [ ] PostgreSQL dependency absent from browser/generic entry points.
- [ ] Type declarations/package exports build correctly.
- [ ] Full repository verification passes.

## CI status

No implementation code exists, so adapter PR CI is not applicable. Documentation-only architecture work must not be represented as adapter validation.

## Documentation / versioning status

Sprint source-of-truth updated through Wednesday. No README/API/version changes are justified because no supported adapter API exists yet.

## Blockers

**Confirmed architectural blocker:** the server persistence/application chain is synchronous while production PostgreSQL I/O is asynchronous. Resolution requires a generic Core async-persistence/server capability with the acceptance gate specified above.

## Deadline assessment

A production PostgreSQL adapter by Saturday is **not realistic under senior-dev/QA standards without the Core prerequisite**. Remaining sprint work will make the prerequisite and PostgreSQL design implementation-ready rather than force unsafe code.

## Final outcome

Pending Saturday closeout. As of Wednesday, PostgreSQL remains correctly blocked; the minimum Core prerequisite, compatibility invariants and acceptance tests are now specified.