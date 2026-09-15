# PostgreSQL Adapter Sprint — 2026-09-13 to 2026-09-19

## Sprint identity
- Adapter: PostgreSQL
- Category: Database / durable persistence
- Branch: `adapter/postgres-sprint-2026-09-13`
- Sprint dates: 2026-09-13 through 2026-09-19
- Status: In progress — PostgreSQL foundation implemented

## Objective / expected outcome
Deliver a production-credible PostgreSQL persistence adapter for Zuno without weakening the synchronous SQLite reference path. Introduce the minimum generic async-persistence capability required by a network database, implement PostgreSQL against it, prove conflict/idempotency/recovery semantics with real integration tests, and finish with documentation, PR and green CI. Documentation-only completion is not acceptable.

## Rationale / developer impact
PostgreSQL is a high-impact production database and the first external persistence adapter beyond SQLite WAL. It validates that Zuno durable authority can operate over remote async storage while preserving CAS, idempotency, replay, snapshot and compaction semantics. The async contract should also provide reusable infrastructure for later remote database adapters.

## Architecture / code impact
Monday established a separate `ZunoAsyncServerPersistence` contract plus `AsyncZunoServerState` orchestration, preserving existing synchronous persistence. Tuesday added `PostgresZunoServerPersistence` against that async contract with an injected structural pool/client interface, schema bootstrap, reads/snapshots/replay bounds, event append, transactional compare-and-set, database idempotency uniqueness, clear/compaction foundation, lifecycle helpers and a `./server/postgres` package export. No PostgreSQL driver is hard-coded into Core; applications can supply a compatible pool (for example node-postgres) without making the core package depend on a particular driver.

## Key risks
- The PostgreSQL foundation has not yet been executed against a live PostgreSQL instance; real-driver integration is now the highest-priority QA gap.
- Concurrent creation of the same previously-absent store key needs explicit contention testing; row locking alone only protects existing rows and database uniqueness/retry behavior must be validated.
- Idempotency races must be normalized into deterministic duplicate results rather than leaking unique-constraint errors.
- Compaction count is currently derived from event-id bounds and must be hardened for gaps/deletions before release.
- Tombstone retention semantics remain incomplete.
- Async transport handlers still need an explicit integration path; promises must never leak through synchronous APIs.
- SSE/transport cost optimization remains a separate post-PostgreSQL milestone.

## Weekly task breakdown
### Sunday — plan and isolate
- [x] Inspect roadmap/durable-authority direction.
- [x] Create dedicated sprint branch.
- [x] Define async prerequisite, compatibility constraints, QA plan and risks.
- [x] Create sprint source-of-truth document.

### Monday — async persistence contract
- [x] Inspect persistence contract and core call sites.
- [x] Implement a minimal async persistence contract without widening the existing synchronous API.
- [x] Add async durable-authority orchestration for record/snapshot/replay/CAS/clear operations.
- [x] Add compatibility tests covering successful CAS, idempotent duplicate, stale-version conflict, replay and preservation of synchronous behavior.
- [ ] Execute focused verification in CI/local runtime; no workflow is triggered for the branch without a PR.

### Tuesday — PostgreSQL foundation
- [x] Create PostgreSQL adapter module following repository conventions.
- [x] Add explicit injected pool/client configuration and connection lifecycle.
- [x] Define/bootstrap schema with store/version/idempotency constraints.
- [x] Implement reads and transactional compare-and-set foundation.
- [ ] Add first real PostgreSQL integration tests — implementation exists, but this run has no provisioned PostgreSQL service/driver execution environment.

### Wednesday — durable log and recovery semantics
- [ ] Harden atomic state + event-log transaction behavior and idempotency races.
- [ ] Harden ranged replay and snapshot APIs with SQL-side filtering/limits.
- [ ] Test duplicate mutation, stale version and restart/reconnect behavior against PostgreSQL.

### Thursday — compaction, failures and concurrency
- [ ] Complete compaction/tombstone behavior.
- [ ] Add concurrent CAS contention, disconnect, rollback and failure-path tests.
- [ ] Verify no correctness dependency on process-local memory.

### Friday — integration/regression hardening
- [ ] Run full relevant test/build/lint/typecheck suite and fix regressions.
- [ ] Validate SQLite and PostgreSQL against shared persistence semantics.
- [ ] Review API ergonomics, connection cleanup and test isolation.

### Saturday — release-quality closure
- [ ] Complete implementation/fixes and full QA.
- [ ] Update README/ROADMAP/persistence docs/examples.
- [ ] Add changeset/version metadata only if release-ready.
- [ ] Finalize sprint report and unresolved risks.
- [ ] Open PR, inspect GitHub Actions and fix CI until green or precisely blocked.

## QA / test checklist
- [ ] Existing SQLite persistence regression suite passes.
- [x] Synchronous persistence API remains structurally unchanged.
- [x] Async authority awaits the remote persistence contract explicitly.
- [x] Compatibility test covers CAS success, duplicate idempotency and stale conflict semantics.
- [x] PostgreSQL schema defines store primary key/version check and partition-scoped idempotency uniqueness.
- [ ] Successful PostgreSQL CAS persists state and durable log atomically — code path implemented, live integration proof pending.
- [ ] Stale CAS cannot partially append/log or overwrite state — transactional path implemented, live proof pending.
- [ ] Duplicate idempotency key cannot apply a mutation twice — lookup + DB uniqueness implemented, race QA pending.
- [ ] Replay ordering/ranges and snapshot/recovery are deterministic.
- [ ] Tombstone/compaction semantics match the generic contract.
- [ ] Transaction failure rolls back all related durable changes.
- [ ] Concurrent writers produce one valid authority outcome.
- [ ] Disconnect/reconnect surfaces controlled errors and recovers cleanly.
- [x] Pool/client ownership is explicit; transaction clients release in `finally`, optional pool close is exposed.
- [ ] TypeScript declarations/build pass.
- [ ] Biome/lint pass.
- [ ] Full repository regression suite passes.
- [ ] GitHub Actions passes on final PR.

## CI status
No PR exists yet, so branch CI remains unverified. Do not interpret implemented code paths as passing QA until build/typecheck/tests and a real PostgreSQL integration run have executed.

## Documentation / versioning status
- Sprint plan/progress: current through Tuesday.
- PostgreSQL package subpath: added as `@iadev93/zuno/server/postgres`.
- User-facing PostgreSQL setup docs: pending integration validation.
- ROADMAP completion update: pending verified delivery.
- Changeset/version bump: intentionally pending.

## Blockers
No design blocker. The current verification gap is environmental: a live PostgreSQL service plus compatible driver/runtime is required to prove the adapter's SQL and transaction behavior. This does not stop implementation; Wednesday should continue hardening semantics and add integration-test scaffolding while preserving truthful QA status.

## Senior developer / QA deadline assessment
Saturday remains achievable but now high-risk until a live PostgreSQL test passes. Tuesday met the code-foundation checkpoint but not the stronger live-integration checkpoint. Wednesday must prioritize real integration proof and race correctness over feature breadth.

## Daily progress log
### 2026-09-13 — Sunday
Created `adapter/postgres-sprint-2026-09-13` from `main`, reviewed the SQLite durable-authority direction, converted the previous discovery into an implementation plan, and defined compatibility, integration, concurrency and failure QA checkpoints. No product code changed per Sunday planning rule.

### 2026-09-14 — Monday
Inspected `ZunoServerPersistence`, `ZunoServerState`, `applyStateEvent` and persistence call sites. Implemented `ZunoAsyncServerPersistence` separately and `AsyncZunoServerState` as explicit awaited durable-authority orchestration. Added `asAsyncZunoServerPersistence` and semantic compatibility tests while preserving synchronous APIs.

### 2026-09-15 — Tuesday
Implemented the first PostgreSQL-specific product code. Added an injected PostgreSQL query/pool contract and `PostgresZunoServerPersistence`; schema bootstrap creates materialized-state and replay-event tables with version and partition-scoped idempotency constraints. Added authoritative reads, snapshots, replay/bounds, append, transactional CAS, state upsert/delete, replay trimming, clear/compaction foundation, explicit client release/pool close, server barrel export and `./server/postgres` package subpath. Kept the driver structural rather than adding a runtime dependency to Core. QA review identified two release-critical items for Wednesday: prove behavior against a real PostgreSQL instance and harden races for first-write CAS/idempotency. No live PostgreSQL test or CI run was available today, so those checks remain explicitly unverified.

## Final outcome
Pending sprint completion.
