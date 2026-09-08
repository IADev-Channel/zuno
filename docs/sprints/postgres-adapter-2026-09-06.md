# PostgreSQL Adapter Sprint

## Sprint identity

- Adapter/category: PostgreSQL / database & durable storage
- Branch: `adapter/postgres-sprint-2026-09-06`
- Sprint dates: 2026-09-06 through 2026-09-12
- Status: blocked on prerequisite Core async-persistence milestone after Tuesday propagation review

## Objective / expected outcome

Deliver a production-oriented PostgreSQL persistence adapter for Zuno that implements the durable-authority semantics already established by the SQLite reference adapter: transactional compare-and-set state updates, partition-scoped idempotency, durable replay/event-log operations, snapshots and compaction behavior, and restart-safe authoritative state.

The intended developer outcome is that teams already operating PostgreSQL can use their existing production database as Zuno's durable authority rather than introducing SQLite or building a custom persistence implementation.

## Rationale / user impact

PostgreSQL is the highest-impact conventional shared database target for multi-process Zuno deployments. It also provides a valuable pressure test of whether the current persistence boundary is truly database-neutral.

This sprint deliberately does not add MongoDB, MySQL, Redis, Supabase, Firebase, or infrastructure adapters. One adapter remains the unit of delivery.

## Architecture and code impact

Sunday expected PostgreSQL to fit the existing `ZunoServerPersistence` boundary. Monday's detailed contract review found a material architectural mismatch: every method on `ZunoServerPersistence` is synchronous (`getRecord`, `getSnapshot`, `readEvents`, `getReplayBounds`, `appendEvent`, `compact`, `clear`, and `compareAndSet`). The SQLite reference can satisfy that because `node:sqlite` exposes synchronous operations. Normal production PostgreSQL clients are networked/asynchronous, so a correct PostgreSQL implementation cannot honestly implement this interface without blocking hacks, subprocess indirection, or pretending asynchronous I/O is synchronous.

Tuesday traced the propagation beyond the persistence interface. `ZunoServerState` exposes synchronous reads, replay helpers, append, CAS, clear, and deprecated mutation helpers directly over persistence. `applyStateEvent()` is also synchronous and performs a persistence-backed read when materializing deltas before calling synchronous CAS. Existing benchmarks, capacity tooling, tests, and framework-facing mutation flows call these synchronous server APIs. Therefore adding only `Promise` return types to `ZunoServerPersistence` would not be a small adapter-local extension: correct remote persistence requires an explicit asynchronous server execution path and asynchronous mutation application, with deliberate compatibility semantics for existing synchronous Memory/SQLite users.

Senior-dev architecture decision: do not broaden this adapter sprint into a Core API migration. PostgreSQL is formally blocked on a dedicated generic async-persistence Core milestone. That milestone should design async persistence/server interfaces, preserve the existing synchronous path for Memory/SQLite where practical, define async delta materialization/CAS/replay behavior, and provide migration/adapter guidance. PostgreSQL should resume only after that contract is tested independently.

Architectural rules remain:

- Preserve durable-authority semantics and atomic compare-and-set behavior.
- Do not leak PostgreSQL-specific concepts into browser/core APIs.
- Keep database drivers out of generic/browser entry points.
- Do not add blocking/event-loop hacks to force PostgreSQL into a synchronous interface.
- Any async persistence evolution must be generic enough for PostgreSQL and future remote adapters.
- Preserve current synchronous APIs until a deliberate compatibility design exists.

## Compatibility and regression risks

Confirmed primary risk is API propagation. Async persistence affects `ZunoServerState` reads/writes/replay, `applyStateEvent()` delta materialization and CAS, and consumers that currently assume immediate return values. A partial Promise-aware implementation could create races, accidentally publish before durable commit, or silently change framework behavior.

Other PostgreSQL risks remain transaction boundaries, concurrent CAS/idempotency, replay ordering, JSON serialization, startup/schema races, lifecycle management, and driver bundling boundaries. These remain adapter work after the Core prerequisite.

## Weekly task breakdown

### Sunday — planning
- [x] Inspect roadmap/package inventory and confirm PostgreSQL is not duplicated.
- [x] Create sprint branch and source-of-truth document.
- [x] Define scope, risks, QA strategy, and deadline assessment.

### Monday — contract and skeleton
- [x] Inspect persistence interface and SQLite implementation in detail.
- [x] Assess PostgreSQL client/dependency strategy.
- [x] Identify synchronous persistence contract as a hard architectural blocker for a production PostgreSQL client.
- [x] Defer adapter skeleton rather than manufacture throwaway architecture.

### Tuesday — architecture decision checkpoint
- [x] Inspect server call sites to quantify async-persistence propagation precisely.
- [x] Determine whether a small backward-compatible async extension is possible without redesigning existing synchronous persistence behavior.
- [x] Conclude propagation is broad enough to require a dedicated Core milestone.
- [x] Formally block PostgreSQL implementation rather than force unsafe scope expansion.

### Wednesday — blocker specification
- [ ] Document the minimum Core async-persistence contract required to unblock PostgreSQL, including compatibility invariants and acceptance tests.

### Thursday — adapter design while blocked
- [ ] Define PostgreSQL schema/transaction strategy against the proposed generic contract without committing implementation tied to an unapproved API.

### Friday — QA/design review
- [ ] Review proposed Core prerequisite and PostgreSQL design for race, idempotency, replay, lifecycle, and packaging risks.

### Saturday — blocker closeout
- [ ] Finalize exact prerequisite milestone and sprint report.
- [ ] Do not publish a fake/unsafe PostgreSQL adapter.
- [ ] Do not create an implementation PR unless the prerequisite becomes valid and verified.
- [ ] Do not merge a PR.

## Daily progress log

### Sunday — 2026-09-06
Planning completed. PostgreSQL selected as first additional persistence adapter. No implementation changes were made by design.

### Monday — 2026-09-07
Performed detailed contract review of `packages/zuno/src/server/persistence.ts`, `packages/zuno/src/server/sqlite-persistence.ts`, and server persistence documentation. Confirmed `ZunoServerPersistence` is entirely synchronous and `compareAndSet()` is explicitly the atomic authoritative write boundary. SQLite fits because its current implementation uses synchronous `node:sqlite` transactions. A production PostgreSQL connection is remote/asynchronous, so it cannot implement the existing interface correctly without an architectural workaround that would harm event-loop behavior or correctness.

Senior-dev decision: do not create a cosmetic PostgreSQL class or introduce blocking hacks merely to satisfy Monday's skeleton checkbox.

### Tuesday — 2026-09-08
Traced the synchronous contract through `ZunoServerState`, `applyStateEvent()`, benchmarks/capacity tooling, and tests. The mismatch is not isolated to `compareAndSet()`: state reads, snapshots, replay bounds/events, delta materialization, append/clear, and mutation application all assume immediate persistence results. A generic remote-database path therefore requires explicit async server/application APIs rather than changing the persistence interface alone.

Decision checkpoint result: the safe change is too broad for an adapter-local compatibility patch. PostgreSQL is formally blocked on a dedicated Core async-persistence milestone. No adapter implementation was added, preventing throwaway code and preventing a hidden breaking change to existing Memory/SQLite and framework consumers.

## QA / test checklist

- [x] Existing persistence contract reviewed against PostgreSQL execution model.
- [x] SQLite atomicity/reference implementation reviewed.
- [x] Persistence call-site propagation through server state reviewed.
- [x] Durable mutation path (`applyStateEvent`) reviewed for async impact.
- [x] Tooling/tests reviewed for synchronous server API assumptions.
- [ ] Core async-persistence compatibility acceptance tests specified.
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

No implementation code has been added, so adapter PR CI is not applicable. The branch currently contains architecture/planning documentation only. CI must not be represented as adapter validation while the prerequisite contract is unresolved.

## Documentation / versioning status

Sprint source-of-truth updated through Tuesday with the propagation analysis and formal blocker decision. No README/API/version changes are justified yet because no supported adapter API exists.

## Blockers

**Confirmed architectural blocker:** `ZunoServerPersistence` and the server/application call chain are synchronous while production PostgreSQL I/O is asynchronous. Correct resolution requires a generic Core async-persistence/server capability, not a PostgreSQL-specific workaround.

Minimum prerequisite direction: provide an explicit asynchronous persistence/server path with atomic async CAS, async record/snapshot/replay operations, async mutation application (including delta materialization), deterministic publish-after-commit behavior, and a compatibility strategy that does not silently turn today's synchronous Memory/SQLite APIs into Promises.

## Deadline assessment

A production PostgreSQL adapter by Saturday is **not realistic under senior-dev/QA standards without first completing the Core prerequisite**. The sprint will use the remaining days to make the prerequisite and PostgreSQL design implementation-ready rather than force unsafe code. This is a blocker closeout outcome, not a completed adapter release.

## Final outcome

Pending Saturday closeout. As of Tuesday, PostgreSQL implementation is formally blocked on a dedicated Core async-persistence milestone. The sprint has validated that the blocker is systemic and has intentionally avoided adapter-specific hacks or a broad unplanned breaking migration.