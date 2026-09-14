# PostgreSQL Adapter Sprint — 2026-09-13 to 2026-09-19

## Sprint identity

- Adapter: PostgreSQL
- Category: Database / durable persistence
- Branch: `adapter/postgres-sprint-2026-09-13`
- Sprint dates: 2026-09-13 through 2026-09-19
- Status: In progress — async persistence boundary implemented

## Objective / expected outcome

Deliver a production-credible PostgreSQL persistence adapter for Zuno without weakening the synchronous SQLite reference path. Introduce the minimum generic async-persistence capability required by a network database, implement PostgreSQL against it, prove conflict/idempotency/recovery semantics with real integration tests, and finish with documentation, PR and green CI. Documentation-only completion is not acceptable.

## Rationale / developer impact

PostgreSQL is a high-impact production database and the first external persistence adapter beyond SQLite WAL. It validates that Zuno durable authority can operate over remote async storage while preserving CAS, idempotency, replay, snapshot and compaction semantics. The async contract should also provide reusable infrastructure for later remote database adapters.

## Architecture / code impact

Monday established a deliberately separate `ZunoAsyncServerPersistence` contract plus `AsyncZunoServerState` orchestration. Existing `ZunoServerPersistence`, `ZunoServerState`, memory/file/SQLite behavior and synchronous error timing remain unchanged. A compatibility lift helper allows synchronous implementations to run through the async contract for shared semantic tests. PostgreSQL will implement the async contract directly.

Expected remaining impact: PostgreSQL package/module and schema, transactional state/event-log writes, idempotency/replay/snapshot/compaction, connection lifecycle, integration tests, docs and package metadata.

## Key risks

- Async transport handlers still need an explicit integration path; promises must never leak through synchronous APIs.
- PostgreSQL transaction boundaries must reproduce SQLite atomic state-and-log semantics.
- Concurrent CAS, database-enforced idempotency, pool exhaustion, disconnects and retries need deterministic behavior.
- Integration tests require isolated PostgreSQL lifecycle and must not become flaky.
- PostgreSQL details must not leak into the generic async contract.
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
- [ ] Create PostgreSQL adapter package/module following repository conventions.
- [ ] Add explicit configuration and connection lifecycle.
- [ ] Define/bootstrap schema with partition/store/version/idempotency constraints.
- [ ] Implement reads and transactional compare-and-set foundation.
- [ ] Add first real PostgreSQL integration tests.

### Wednesday — durable log and recovery semantics
- [ ] Implement atomic state + event-log transaction behavior and idempotency.
- [ ] Implement ranged replay and snapshot APIs.
- [ ] Test duplicate mutation, stale version and restart/reconnect behavior.

### Thursday — compaction, failures and concurrency
- [ ] Implement required compaction/tombstone behavior.
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
- [ ] PostgreSQL schema constraints enforce store/version/idempotency invariants.
- [ ] Successful PostgreSQL CAS persists state and durable log atomically.
- [ ] Stale CAS cannot partially append/log or overwrite state.
- [ ] Duplicate idempotency key cannot apply a mutation twice.
- [ ] Replay ordering/ranges and snapshot/recovery are deterministic.
- [ ] Tombstone/compaction semantics match the generic contract.
- [ ] Transaction failure rolls back all related durable changes.
- [ ] Concurrent writers produce one valid authority outcome.
- [ ] Disconnect/reconnect surfaces controlled errors and recovers cleanly.
- [ ] Connections/pools close correctly.
- [ ] TypeScript declarations/build pass.
- [ ] Biome/lint pass.
- [ ] Full repository regression suite passes.
- [ ] GitHub Actions passes on final PR.

## CI status

No GitHub Actions run exists yet for Monday's branch head because the sprint branch has no PR and the repository workflow did not trigger on these commits. Verification remains explicitly pending rather than being reported as green.

## Documentation / versioning status

- Sprint plan/progress: current through Monday.
- User-facing PostgreSQL setup docs: pending implementation.
- ROADMAP completion update: pending verified delivery.
- Changeset/version bump: intentionally pending.

## Blockers

No external blocker currently. The async persistence prerequisite is no longer a design-only blocker: the minimal separate async contract and orchestration now exist. Tuesday's critical dependency is obtaining a real PostgreSQL-backed integration path and test database lifecycle.

## Senior developer / QA deadline assessment

Saturday remains realistic but medium-risk. Monday kept the compatibility boundary narrow by not converting existing synchronous server APIs to union/promise returns. Tuesday remains the go/no-go checkpoint: a real PostgreSQL integration test must connect, bootstrap schema and exercise at least one authoritative read/CAS path. Missing that checkpoint moves delivery to high risk.

## Daily progress log

### 2026-09-13 — Sunday

Created `adapter/postgres-sprint-2026-09-13` from `main`, reviewed the SQLite durable-authority direction, converted the previous discovery into an implementation plan, and defined compatibility, integration, concurrency and failure QA checkpoints. No product code changed per Sunday planning rule.

### 2026-09-14 — Monday

Inspected `ZunoServerPersistence`, `ZunoServerState`, `applyStateEvent` and persistence call sites. The existing contract is fully synchronous and is directly consumed by synchronous server APIs, so widening its return values to promises would silently break callers. Implemented `ZunoAsyncServerPersistence` as a separate remote-storage contract and `AsyncZunoServerState` as explicit awaited durable-authority orchestration. Added `asAsyncZunoServerPersistence` so existing sync adapters can participate in shared semantic tests without changing their public behavior. Added tests for CAS success, duplicate idempotency, stale-version conflict, record/replay access, replay bounds, and proof that the original memory persistence still returns synchronously. Exported the new async infrastructure from the server entry point. No PostgreSQL-specific code was started early. GitHub Actions has not run on the branch head, so runtime verification remains pending and is not represented as passing.

## Final outcome

Pending sprint completion.
