# PostgreSQL Adapter Sprint — 2026-09-13 to 2026-09-19

## Sprint identity
- Adapter: PostgreSQL
- Category: Database / durable persistence
- Branch: `adapter/postgres-sprint-2026-09-13`
- Sprint dates: 2026-09-13 through 2026-09-19
- Status: In progress — Friday package-boundary QA found/fixed missing build entry; live PostgreSQL proof pending

## Objective / expected outcome
Deliver a production-credible PostgreSQL persistence adapter for Zuno without weakening the synchronous SQLite reference path. Introduce the minimum generic async-persistence capability required by a network database, implement PostgreSQL against it, prove conflict/idempotency/recovery semantics with real integration tests, and finish with documentation, PR and green CI. Documentation-only completion is not acceptable.

## Rationale / developer impact
PostgreSQL is a high-impact production database and the first external persistence adapter beyond SQLite WAL. It validates that Zuno durable authority can operate over remote async storage while preserving CAS, idempotency, replay, snapshot and compaction semantics. The async contract should also provide reusable infrastructure for later remote database adapters.

## Architecture / code impact
Monday established a separate `ZunoAsyncServerPersistence` contract plus `AsyncZunoServerState` orchestration, preserving existing synchronous persistence. Tuesday added `PostgresZunoServerPersistence` against that async contract with an injected structural pool/client interface. Wednesday hardened concurrency with transaction-scoped advisory locks and SQL-side replay/snapshot filtering. Thursday aligned compaction with the generic tombstone policy, added explicit JavaScript safe-integer guards for PostgreSQL BIGINT identifiers/versions/timestamps/counts, prevented version overflow, added an operation/timestamp retention index, and made rollback best-effort so a failed connection during rollback does not mask the original transaction error. Friday package-boundary review found that `./server/postgres` was exported from package metadata but was missing from the tsup entry list; the build entry was added. No PostgreSQL driver is hard-coded into Core.

## Key risks
- The PostgreSQL implementation has still not executed against a live PostgreSQL instance; real-driver integration is the highest-priority remaining QA gap.
- Advisory-lock behavior and lock ordering require live concurrent integration proof.
- Async transport handlers still need an explicit integration path; promises must never leak through synchronous APIs.
- BIGINT values outside JavaScript's safe integer range now fail explicitly rather than silently losing precision; a future bigint-native API would be a breaking design decision.
- Ambiguous connection loss during COMMIT remains fundamentally uncertain; callers must retry with an idempotency key to discover/reuse an already-committed mutation.
- SSE/transport cost optimization remains a separate post-PostgreSQL milestone.

## Weekly task breakdown
### Sunday — plan and isolate
- [x] Inspect roadmap/durable-authority direction.
- [x] Create dedicated sprint branch.
- [x] Define async prerequisite, compatibility constraints, QA plan and risks.
- [x] Create sprint source-of-truth document.

### Monday — async persistence contract
- [x] Implement a minimal async persistence contract without widening the existing synchronous API.
- [x] Add async durable-authority orchestration and compatibility tests.
- [ ] Execute focused verification in CI/local runtime; no workflow is triggered for the branch without a PR.

### Tuesday — PostgreSQL foundation
- [x] Add PostgreSQL adapter, injected pool/client contract, schema, reads and transactional CAS foundation.
- [ ] Add first real PostgreSQL integration tests — no provisioned PostgreSQL service/driver execution environment is available in this run.

### Wednesday — durable log and recovery semantics
- [x] Harden state/event transactions and idempotency/first-write races with transaction-scoped advisory locks.
- [x] Push replay/snapshot filtering into SQL and fix compaction row accounting.
- [ ] Prove contention/restart behavior against live PostgreSQL.

### Thursday — compaction, failures and concurrency
- [x] Complete tombstone-specific retention behavior matching the generic persistence contract.
- [x] Define safe BIGINT behavior: reject unsafe numeric conversion rather than silently corrupt IDs/versions.
- [x] Harden rollback error handling and retain process-independent database locking.
- [ ] Add/run live concurrent CAS, disconnect and rollback integration tests — environment remains unavailable.

### Friday — integration/regression hardening
- [x] Review API/package boundary and catch missing PostgreSQL build entry.
- [x] Add `src/server/postgres-persistence.ts` to tsup entries so the published `./server/postgres` export has actual ESM/CJS/declaration artifacts.
- [ ] Run full relevant test/build/lint/typecheck suite and fix regressions — execution environment unavailable in this run; final PR CI remains required.
- [ ] Validate SQLite and PostgreSQL against shared persistence semantics with executable integration coverage.
- [x] Review connection cleanup and package isolation statically.

### Saturday — release-quality closure
- [ ] Complete implementation/fixes and full QA.
- [ ] Update README/ROADMAP/persistence docs/examples.
- [ ] Add changeset/version metadata only if release-ready.
- [ ] Finalize sprint report and unresolved risks.
- [ ] Open PR, inspect GitHub Actions and fix CI until green or precisely blocked.

## QA / test checklist
- [ ] Existing SQLite persistence regression suite passes.
- [x] Synchronous persistence API remains structurally unchanged.
- [x] Async authority awaits remote persistence explicitly.
- [x] PostgreSQL schema defines state/version and partition-scoped idempotency constraints.
- [x] First-write CAS and duplicate idempotency races use database-scoped transaction locks; live proof pending.
- [x] Replay partition/topic filtering and limits are SQL-side.
- [x] Tombstones use `tombstoneRetentionMs` independently of ordinary `retentionMs`.
- [x] BIGINT conversions reject values outside `Number.isSafeInteger` instead of silently losing precision.
- [x] State version increment refuses to cross JavaScript's safe-integer boundary.
- [x] Rollback failure cannot replace the original transaction/connection error.
- [x] Pool/client ownership is explicit; transaction clients release in `finally`.
- [x] Package export now has a matching tsup build entry.
- [ ] Successful PostgreSQL CAS persists state and log atomically — implemented, live proof pending.
- [ ] Stale CAS cannot partially append/log or overwrite state — implemented, live proof pending.
- [ ] Concurrent writers produce one valid authority outcome under live contention.
- [ ] Disconnect/reconnect surfaces controlled errors and recovers cleanly.
- [ ] TypeScript declarations/build pass.
- [ ] Biome/lint pass.
- [ ] Full repository regression suite passes.
- [ ] GitHub Actions passes on final PR.

## CI status
No PR exists yet, so branch CI remains unverified. Friday static/package QA found a release-blocking packaging defect before PR: `package.json` exported `@iadev93/zuno/server/postgres`, but tsup did not build `postgres-persistence.ts`; commit `2544c2a` fixes the build entry. The branch is still not considered QA-passed until build/typecheck/tests, live PostgreSQL integration and final PR CI execute.

## Documentation / versioning status
- Sprint plan/progress: current through Friday.
- PostgreSQL remains behind `@iadev93/zuno/server/postgres`; the structural pool/client contract keeps driver choice outside Core.
- User-facing PostgreSQL setup docs, ROADMAP completion and changeset/version bump remain pending verified delivery.

## Blockers
No design blocker. The verification gap is environmental: a live PostgreSQL service plus compatible driver/runtime is required to prove SQL, advisory locks, rollback/reconnect and concurrent transactions. The available repository connector can review and mutate source but cannot execute the repository; the local execution environment also cannot reach GitHub to clone/install dependencies. Static review is not treated as executable proof.

## Senior developer / QA deadline assessment
Saturday remains possible but release readiness is high-risk until executable verification runs. Friday demonstrated why release/package review matters: the implementation existed and package metadata advertised it, but the bundler would not have emitted the exported PostgreSQL entrypoint. That defect is now fixed. Saturday must not mark the adapter complete unless executable verification and real PostgreSQL behavior are proven; if final PR CI cannot provide the database proof, the exact remaining blocker must stay explicit.

## Daily progress log
### 2026-09-13 — Sunday
Created the sprint branch, reviewed durable-authority direction and defined compatibility/integration/concurrency/failure QA checkpoints. No product code changed per Sunday planning rule.

### 2026-09-14 — Monday
Implemented `ZunoAsyncServerPersistence`, `AsyncZunoServerState`, compatibility bridging and semantic tests while preserving synchronous APIs.

### 2026-09-15 — Tuesday
Implemented `PostgresZunoServerPersistence`, schema bootstrap, reads/snapshots/replay, transactional CAS, event log, trimming/clear/compaction foundation, lifecycle management and server export. Live PostgreSQL QA remained unavailable.

### 2026-09-16 — Wednesday
Added transaction-scoped advisory locking for absent-row CAS and idempotency races, moved replay/snapshot filtering into SQL, added matching indexing and fixed compaction counting so sequence gaps do not distort deletion counts.

### 2026-09-17 — Thursday
Aligned PostgreSQL compaction with `ZunoCompactionPolicy`: ordinary events now use `retentionMs` while delete tombstones independently use `tombstoneRetentionMs`, with an operation/timestamp index supporting retention cleanup. Replaced unchecked PostgreSQL BIGINT-to-Number conversions with explicit safe-integer validation across event IDs, state/event versions, timestamps and counts; version increments now refuse unsafe overflow. Hardened transaction failure handling with best-effort rollback so a broken connection during rollback cannot mask the original failure. Reconfirmed that correctness locking is PostgreSQL-scoped rather than process-local. Live database concurrency/disconnect proof remains intentionally unclaimed.

### 2026-09-18 — Friday
Performed package/release-boundary QA rather than adding scope. Found a concrete release blocker: `package.json` already exposed `./server/postgres`, but `packages/zuno/tsup.config.ts` only built root, server and SQLite entries, so published PostgreSQL ESM/CJS/declaration files would have been missing. Added the PostgreSQL persistence entry to tsup in commit `2544c2a`. Reviewed the branch against main: it is isolated to the async persistence foundation, PostgreSQL implementation/tests, package export/build entry and sprint documentation. Executable verification remains unclaimed because no live PostgreSQL/runtime execution environment is available in this run.

## Final outcome
Pending sprint completion.
