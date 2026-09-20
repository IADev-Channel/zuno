# PostgreSQL Package Extraction Sprint — 2026-09-20 to 2026-09-22

## Sprint identity
- Adapter: `@iadev93/zuno-postgresql`
- Category: Database / durable persistence
- Branch: `adapter/postgresql-package-2026-09-20`
- Target dates: 2026-09-20 through 2026-09-22 (3-day closure target)
- Status: Planning / extraction continuation

## Objective / expected outcome
Finish the PostgreSQL work already developed on PR #10 by correcting the package boundary: Zuno Core owns only the generic async persistence contract/orchestration, while all PostgreSQL-specific implementation, schema/SQL, transaction/advisory-lock behavior and PostgreSQL integration tests live in a standalone `@iadev93/zuno-postgresql` package. Then establish executable PostgreSQL and repository verification before declaring the adapter complete.

## Rationale / developer impact
A universal state-management core should define persistence behavior without owning every database implementation. A standalone PostgreSQL adapter keeps Core database-agnostic, makes the dependency/driver boundary explicit, gives future MongoDB/MySQL/etc. adapters a consistent package pattern, and lets developers install only the persistence technology they use.

## Architecture / code impact
### Keep in `@iadev93/zuno`
- `ZunoAsyncServerPersistence` generic contract.
- `AsyncZunoServerState` generic orchestration.
- Generic persistence types/semantics and compatibility coverage.
- Existing built-in SQLite behavior remains unchanged for this sprint.

### Move to `@iadev93/zuno-postgresql`
- `PostgresZunoServerPersistence` / PostgreSQL adapter implementation.
- PostgreSQL schema/bootstrap SQL.
- PostgreSQL transaction, CAS, idempotency and advisory-lock logic.
- PostgreSQL BIGINT conversion guards.
- PostgreSQL replay/compaction SQL behavior.
- PostgreSQL-specific unit/integration tests and package documentation.

### Remove from Core public/package surface
- `@iadev93/zuno/server/postgres` export.
- Core tsup PostgreSQL build entry.
- Any PostgreSQL-specific implementation files/tests that no longer belong to Core.

The standalone package should depend on Core's public generic contract rather than private/internal implementation details. Driver ownership remains explicit; no PostgreSQL client should leak into browser/core paths.

## Key risks
- Package extraction can accidentally create circular workspace dependencies or import Core internals rather than public contracts.
- Moving tests without live PostgreSQL proof could preserve a structurally clean but unverified adapter.
- Existing async persistence changes must not regress SQLite or synchronous APIs.
- PostgreSQL advisory-lock/CAS/idempotency behavior still requires real concurrent integration proof.
- Package exports, declarations and workspace build order must be verified after extraction.
- Do not broaden scope into MongoDB/MySQL or Peak Optimization during this closure sprint.

## Weekly / 3-day task breakdown
### Sunday — boundary and plan
- [x] Continue from the unmerged PostgreSQL implementation rather than start a second adapter.
- [x] Create dedicated continuation branch from PR #10 head before making changes.
- [x] Record the agreed architecture: contract in Core; PostgreSQL in `@iadev93/zuno-postgresql`.
- [x] Create this sprint source-of-truth document.
- [ ] Inspect existing workspace package conventions and exact extraction file set before implementation.

### Monday — extraction + executable proof
- [ ] Create standalone PostgreSQL workspace package following existing package conventions.
- [ ] Move PostgreSQL implementation/tests out of Core and wire imports only through public generic persistence APIs.
- [ ] Remove Core PostgreSQL export/build entry and confirm Core remains PostgreSQL-agnostic.
- [ ] Add/configure real PostgreSQL integration coverage for schema/bootstrap, CAS, first-write concurrency, duplicate idempotency, rollback/retry, replay and compaction.
- [ ] Run focused package/core verification and fix discovered defects.

### Tuesday — closure target
- [ ] Run full relevant build/typecheck/lint/tests and SQLite regressions.
- [ ] Run live concurrent PostgreSQL integration suite and failure/recovery cases.
- [ ] Verify package exports/declarations/install boundary.
- [ ] Fix defects only; no new PostgreSQL features.
- [ ] Update README/roadmap/package docs and version metadata only when verification is green.
- [ ] Push final branch state, update/replace PR as appropriate for the new branch boundary, and inspect CI to green or document exact external blocker.
- [ ] Finalize sprint report and mark complete only if release gates pass.

## QA / test checklist
- [ ] Core has no PostgreSQL-specific public export/build entry/implementation.
- [ ] `@iadev93/zuno-postgresql` consumes the public async persistence contract.
- [ ] Existing synchronous SQLite API/regression suite remains green.
- [ ] Core async persistence semantic tests remain green.
- [ ] PostgreSQL schema initializes against a real database.
- [ ] Successful CAS persists state and event atomically.
- [ ] Stale CAS cannot partially mutate state/log.
- [ ] Concurrent first-write/writer contention has one valid authority outcome.
- [ ] Concurrent duplicate idempotency keys do not double-apply mutations.
- [ ] Transaction rollback and retry behavior is controlled.
- [ ] Disconnect/reconnect behavior surfaces controlled errors and recovers.
- [ ] Replay/snapshot/compaction/tombstone retention semantics pass.
- [ ] BIGINT safe-integer guards pass boundary cases.
- [ ] Package build emits ESM/CJS/declarations matching exports.
- [ ] Typecheck/lint/full relevant repository tests pass.
- [ ] GitHub Actions passes on final PR head.

## CI status
Not evaluated for this continuation branch yet. PR #10 remains unmerged and is the source implementation; its prior release gate was explicitly blocked on executable/live PostgreSQL verification. The continuation branch starts from that PR head so no implementation work is discarded.

## Documentation / versioning status
This planning document is the only Sunday documentation change. User-facing release docs and package/version metadata remain gated on successful extraction and executable verification; they must not imply release readiness prematurely.

## Blockers
No architecture blocker. The main technical release gate remains executable verification against a real PostgreSQL instance plus repository CI. If the available execution/CI environment cannot provision PostgreSQL, the adapter remains blocked rather than being marked complete.

## Senior developer / QA deadline assessment
A three-day closure is realistic because the substantive PostgreSQL implementation already exists. Scope is intentionally constrained to package extraction, verification and defects revealed by verification. The deadline becomes unrealistic only if live testing exposes a correctness flaw in transaction/concurrency semantics; such a flaw must be fixed rather than hidden to meet the date.

## Daily progress log
### 2026-09-20 — Sunday
Reviewed the open PostgreSQL work and the newly agreed package boundary. Created `adapter/postgresql-package-2026-09-20` directly from PR #10 head (`546cb2881687c6523baa727eaaf52d21e3401535`) so the existing implementation is preserved while the package architecture is corrected. Defined a three-day closure plan: Sunday boundary/planning, Monday extraction plus live proof, Tuesday regression/CI/docs closure. No product implementation was changed on Sunday.

## Final outcome
Pending. Completion requires both the standalone `@iadev93/zuno-postgresql` boundary and executable PostgreSQL/CI evidence. After closure, the next milestone is Zuno sync/SSE peak-efficiency optimization rather than another database adapter immediately.