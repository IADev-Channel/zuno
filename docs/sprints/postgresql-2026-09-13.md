# PostgreSQL Adapter Sprint — 2026-09-13 to 2026-09-19

## Sprint identity

- Adapter: PostgreSQL
- Category: Database / durable persistence
- Branch: `adapter/postgres-sprint-2026-09-13`
- Sprint dates: 2026-09-13 through 2026-09-19
- Status: In progress — planning complete

## Objective / expected outcome

Deliver a production-credible PostgreSQL persistence adapter for Zuno without weakening the synchronous SQLite reference path. The sprint must first introduce the minimum generic async-persistence capability required by a network database, then implement PostgreSQL against that contract, prove conflict/idempotency/recovery semantics with real integration tests, and finish with documentation plus a reviewable PR and green CI.

The sprint is successful only if PostgreSQL actually works end-to-end. Documentation-only completion is not acceptable.

## Why this adapter should exist

PostgreSQL is a high-impact production database and a natural first external persistence adapter beyond the existing SQLite WAL authority. It tests whether Zuno's durable-authority abstraction is genuinely portable to remote, asynchronous storage rather than accidentally coupled to an in-process synchronous database.

Developer impact:

- enables Zuno authority state to live in a common production database;
- provides a realistic deployment path where application and database are separate processes/services;
- validates Zuno's CAS, idempotency, replay, snapshot and compaction semantics under async I/O;
- establishes an async persistence contract reusable by later MongoDB/MySQL/Supabase-style integrations where appropriate.

## Architecture / code impact

Expected affected areas:

1. Core/server persistence contract: introduce the smallest backwards-compatible async boundary needed for remote adapters. Prefer accepting sync-or-promise results at the orchestration boundary rather than converting unrelated public APIs to async.
2. Existing SQLite adapter: retain current behavior and compatibility; regression tests must prove it remains valid.
3. Server mutation/replay/snapshot/compaction paths: await persistence only where durable operations require it; preserve ordering and compare-and-set semantics.
4. New PostgreSQL package/module: connection/configuration, schema/bootstrap strategy, transactional state + event-log mutation, idempotency, replay ranges, snapshots/compaction and cleanup lifecycle.
5. Tests/CI: unit tests for contract behavior plus PostgreSQL integration tests using an isolated test database/service.
6. Docs/package metadata: setup, schema/migration expectations, operational caveats, exports and changeset/versioning only after implementation is real.

Compatibility principle: the async capability is infrastructure, not a redesign of Zuno's client state API.

## Key risks

- Async propagation may accidentally change existing synchronous APIs or error timing.
- Transaction boundaries may not exactly reproduce SQLite atomic state-and-log semantics.
- Concurrent CAS mutations can expose race conditions hidden by SQLite's local execution model.
- Idempotency must be database-enforced, not process-memory-enforced.
- Connection pool exhaustion, transaction retries and database disconnects require deterministic failure behavior.
- Integration tests can become flaky if database lifecycle/isolation is weak.
- PostgreSQL-specific SQL/schema decisions must not leak into the generic persistence contract.
- Scope creep: SSE/transport cost optimization is important but is a separate post-PostgreSQL milestone and must not be mixed into this adapter sprint.

## Weekly task breakdown

### Sunday — plan and isolate

- [x] Inspect current roadmap and durable-authority direction.
- [x] Create dedicated sprint branch before modifications.
- [x] Define async-persistence prerequisite and compatibility constraints.
- [x] Define PostgreSQL delivery/QA plan and risks.
- [x] Create this sprint source-of-truth document.

### Monday — async persistence contract

- [ ] Inspect all persistence call sites and exact SQLite contract.
- [ ] Implement minimal sync-or-async persistence typing/orchestration.
- [ ] Add regression tests proving existing synchronous adapters remain compatible.
- [ ] Run focused core/server verification.

### Tuesday — PostgreSQL foundation

- [ ] Create PostgreSQL adapter package/module following repository conventions.
- [ ] Add explicit configuration and connection lifecycle.
- [ ] Define/bootstrap schema with partition/store/version/idempotency constraints.
- [ ] Implement reads and transactional compare-and-set state mutation foundation.
- [ ] Add first real PostgreSQL integration tests.

### Wednesday — durable log and recovery semantics

- [ ] Implement atomic state + event-log transaction behavior.
- [ ] Implement idempotency handling.
- [ ] Implement ranged replay and required snapshot APIs.
- [ ] Test duplicate mutation, stale version and restart/reconnect behavior.

### Thursday — compaction, failures and concurrency

- [ ] Implement compaction/tombstone behavior required by the persistence contract.
- [ ] Add concurrent CAS contention tests.
- [ ] Add disconnect/transaction rollback/failure-path tests.
- [ ] Verify no correctness dependency on process-local memory.

### Friday — integration/regression hardening

- [ ] Run full relevant test/build/lint/typecheck suite.
- [ ] Fix regressions and review API/package ergonomics.
- [ ] Validate SQLite and PostgreSQL behavior against the same persistence semantics where practical.
- [ ] Review connection cleanup and test isolation for leaks/flakiness.

### Saturday — release-quality closure

- [ ] Complete remaining implementation/fixes.
- [ ] Run full verification and integration QA.
- [ ] Update README/ROADMAP/persistence docs and examples.
- [ ] Add changeset/version metadata only if release-ready.
- [ ] Finalize this sprint report and unresolved-risk section.
- [ ] Push final branch state, open PR, inspect GitHub Actions, and fix CI failures until green or precisely blocked.

## QA / test checklist

- [ ] Existing SQLite persistence regression suite passes unchanged or with intentional compatibility updates.
- [ ] Sync persistence implementation remains supported.
- [ ] Async persistence implementation is awaited correctly in all durable paths.
- [ ] PostgreSQL schema constraints enforce store/version/idempotency invariants.
- [ ] Successful CAS mutation persists state and corresponding durable log atomically.
- [ ] Stale CAS cannot partially append/log or overwrite state.
- [ ] Duplicate idempotency key cannot apply a mutation twice.
- [ ] Replay ordering/ranges are deterministic.
- [ ] Snapshot/recovery restores authoritative state correctly.
- [ ] Tombstone/compaction semantics match the generic contract.
- [ ] Transaction failure rolls back all related durable changes.
- [ ] Concurrent writers produce one valid authority outcome rather than lost updates.
- [ ] Database disconnect/reconnect surfaces controlled errors and recovers cleanly.
- [ ] Connections/pools are closed in tests and process shutdown paths.
- [ ] TypeScript declarations/build pass.
- [ ] Biome/lint pass.
- [ ] Full repository regression suite passes.
- [ ] GitHub Actions passes on the final PR.

## CI status

Not run yet. Sunday is planning-only; CI becomes meaningful after implementation begins.

## Documentation / versioning status

- Sprint plan: complete.
- User-facing PostgreSQL setup docs: pending implementation.
- ROADMAP completion update: pending verified delivery.
- Changeset/version bump: intentionally pending; do not version an unimplemented adapter.

## Blockers

The prior PostgreSQL discovery established that remote persistence needs an async-capable orchestration boundary. This is now planned as the first implementation deliverable of this sprint rather than treated as a reason to stop the adapter. No external blocker is known at sprint start.

## Senior developer / QA deadline assessment

Saturday delivery is **realistic but medium-risk**. The PostgreSQL SQL itself is not the main risk; the critical path is introducing async persistence without destabilizing SQLite or changing public client semantics. The schedule is achievable if Monday keeps the async boundary narrow and backwards-compatible, and Tuesday produces a real database integration test early. If async propagation expands into a broad Core redesign, scope must be reduced to the minimum contract necessary for PostgreSQL rather than hiding incomplete implementation behind documentation.

Go/no-go checkpoint: by end of Tuesday, a real PostgreSQL integration test should connect, bootstrap schema and exercise at least one authoritative read/CAS path. Missing that checkpoint puts Saturday completion at high risk.

## Daily progress log

### 2026-09-13 — Sunday

Created `adapter/postgres-sprint-2026-09-13` from `main`. Reviewed the roadmap: SQLite WAL remains the production reference authority and additional persistence adapters are explicitly planned. Converted last sprint's async-persistence discovery into this week's concrete implementation critical path. Defined compatibility boundaries, daily deliverables, integration/concurrency/failure QA, and a Tuesday go/no-go checkpoint. No product code changed today, per Sunday planning rule.

## Final outcome

Pending sprint completion.
