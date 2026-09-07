# PostgreSQL Adapter Sprint

## Sprint identity

- Adapter/category: PostgreSQL / database & durable storage
- Branch: `adapter/postgres-sprint-2026-09-06`
- Sprint dates: 2026-09-06 through 2026-09-12
- Status: Monday contract assessment complete; implementation blocked on async persistence contract

## Objective / expected outcome

Deliver a production-oriented PostgreSQL persistence adapter for Zuno that implements the durable-authority semantics already established by the SQLite reference adapter: transactional compare-and-set state updates, partition-scoped idempotency, durable replay/event-log operations, snapshots and compaction behavior, and restart-safe authoritative state.

The intended developer outcome is that teams already operating PostgreSQL can use their existing production database as Zuno's durable authority rather than introducing SQLite or building a custom persistence implementation.

## Rationale / user impact

PostgreSQL is the highest-impact conventional shared database target for multi-process Zuno deployments. It also provides a valuable pressure test of whether the current persistence boundary is truly database-neutral.

This sprint deliberately does not add MongoDB, MySQL, Redis, Supabase, Firebase, or infrastructure adapters. One adapter remains the unit of delivery.

## Architecture and code impact

Sunday expected PostgreSQL to fit the existing `ZunoServerPersistence` boundary. Monday's detailed contract review found a material architectural mismatch: every method on `ZunoServerPersistence` is synchronous (`getRecord`, `getSnapshot`, `readEvents`, `getReplayBounds`, `appendEvent`, `compact`, `clear`, and `compareAndSet`). The SQLite reference can satisfy that because `node:sqlite` exposes synchronous operations. Normal production PostgreSQL clients are networked/asynchronous, so a correct PostgreSQL implementation cannot honestly implement this interface without blocking hacks, subprocess indirection, or pretending asynchronous I/O is synchronous.

This is not a PostgreSQL-specific inconvenience; it is a generic persistence-contract limitation that will also affect most remote databases. Per sprint rules, a large generic persistence redesign must not be rushed into an adapter.

Architectural rules remain:

- Preserve durable-authority semantics and atomic compare-and-set behavior.
- Do not leak PostgreSQL-specific concepts into browser/core APIs.
- Keep database drivers out of generic/browser entry points.
- Do not add blocking/event-loop hacks to force PostgreSQL into a synchronous interface.
- Any async persistence evolution must be generic enough for SQLite and future remote adapters.
- Preserve current synchronous APIs until a deliberate compatibility design exists.

## Compatibility and regression risks

Primary newly confirmed risk is API propagation: making persistence methods asynchronous affects server-state mutation/replay paths and potentially framework adapters and tests. A partial Promise-aware implementation could create race conditions or silent behavior changes. This is larger than an adapter-local change.

Other PostgreSQL risks remain transaction boundaries, concurrent CAS/idempotency, replay ordering, JSON serialization, startup/schema races, lifecycle management, and driver bundling boundaries.

## Weekly task breakdown

### Sunday — planning
- [x] Inspect roadmap/package inventory and confirm PostgreSQL is not duplicated.
- [x] Create sprint branch and source-of-truth document.
- [x] Define scope, risks, QA strategy, and deadline assessment.

### Monday — contract and skeleton
- [x] Inspect persistence interface and SQLite implementation in detail.
- [x] Assess PostgreSQL client/dependency strategy.
- [x] Identify synchronous persistence contract as a hard architectural blocker for a production PostgreSQL client.
- [ ] Adapter skeleton deferred: creating one against an invalid contract would manufacture throwaway architecture.
- [ ] Initial PostgreSQL usage docs deferred until the supported API shape is valid.

### Tuesday — architecture decision checkpoint
- [ ] Inspect server call sites to quantify async-persistence propagation precisely.
- [ ] Determine whether a small backward-compatible async extension is possible without redesigning existing synchronous persistence behavior.
- [ ] If small and safe, implement the generic extension first on this branch and resume PostgreSQL work.
- [ ] If broad/breaking, stop adapter implementation and record a dedicated Core persistence milestone recommendation rather than forcing scope.

### Wednesday — conditional implementation
- [ ] If unblocked, implement PostgreSQL authoritative state/idempotency/event transaction path and focused tests.

### Thursday — conditional hardening
- [ ] If unblocked, implement replay/compaction/lifecycle/failure behavior and regression coverage.

### Friday — conditional integration
- [ ] If unblocked, run PostgreSQL integration and full repository verification.

### Saturday — release-candidate QA / blocker closeout
- [ ] If implementation is valid, complete QA/docs/PR/CI workflow.
- [ ] If the generic async boundary remains a required core milestone, finalize exact blocker and proposed prerequisite; do not publish a fake/unsafe adapter.
- [ ] Do not merge a PR.

## Daily progress log

### Sunday — 2026-09-06
Planning completed. PostgreSQL selected as first additional persistence adapter. No implementation changes were made by design.

### Monday — 2026-09-07
Performed detailed contract review of `packages/zuno/src/server/persistence.ts`, `packages/zuno/src/server/sqlite-persistence.ts`, and server persistence documentation. Confirmed `ZunoServerPersistence` is entirely synchronous and `compareAndSet()` is explicitly the atomic authoritative write boundary. SQLite fits because its current implementation uses synchronous `node:sqlite` transactions. A production PostgreSQL connection is remote/asynchronous, so it cannot implement the existing interface correctly without an architectural workaround that would harm event-loop behavior or correctness.

Senior-dev decision: do not create a cosmetic PostgreSQL class or introduce blocking hacks merely to satisfy Monday's skeleton checkbox. Tuesday will quantify the async propagation through server call sites and determine whether a small backward-compatible generic extension exists. If it requires a broad server API redesign, the PostgreSQL adapter will be formally blocked on a Core persistence milestone.

## QA / test checklist

- [x] Existing persistence contract reviewed against PostgreSQL execution model.
- [x] SQLite atomicity/reference implementation reviewed.
- [ ] Existing SQLite persistence tests remain green after any code changes.
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

No implementation code has been added yet, so PR CI is not applicable. Monday intentionally avoided committing an invalid adapter skeleton.

## Documentation / versioning status

Sprint source-of-truth updated with the discovered contract blocker. No README/API/version changes are justified until the persistence API direction is resolved.

## Blockers

**Active architectural blocker:** `ZunoServerPersistence` is synchronous while production PostgreSQL I/O is asynchronous. Correct resolution may require a generic async persistence capability in Zuno Core/server. The size of that propagation will be assessed Tuesday before deciding whether it safely fits this adapter sprint.

## Deadline assessment

Saturday delivery is now **at risk**. It remains possible only if Tuesday proves that asynchronous persistence can be added as a small backward-compatible extension. If server mutation/replay APIs must broadly become asynchronous, that is a separate Core milestone and the adapter must remain blocked rather than rushing a breaking redesign.

## Final outcome

Pending. Monday produced a concrete architectural finding rather than unsafe implementation.