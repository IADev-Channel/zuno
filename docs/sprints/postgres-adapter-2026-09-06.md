# PostgreSQL Adapter Sprint

## Sprint identity

- Adapter/category: PostgreSQL / database & durable storage
- Branch: `adapter/postgres-sprint-2026-09-06`
- Sprint dates: 2026-09-06 through 2026-09-12
- Status: Planning complete; implementation starts Monday

## Objective / expected outcome

Deliver a production-oriented PostgreSQL persistence adapter for Zuno that implements the durable-authority semantics already established by the SQLite reference adapter: transactional compare-and-set state updates, partition-scoped idempotency, durable replay/event-log operations, snapshots and compaction behavior, and restart-safe authoritative state.

The intended developer outcome is that teams already operating PostgreSQL can use their existing production database as Zuno's durable authority rather than introducing SQLite or building a custom persistence implementation. PostgreSQL is the first additional persistence adapter because it is broadly deployed, operationally mature, and a natural fit for multi-process/server deployments.

## Rationale / user impact

Zuno currently documents SQLite as its production reference authority while the roadmap explicitly calls for additional persistence adapters. PostgreSQL closes the largest practical database gap without changing Zuno's conflict model. It should make Zuno easier to adopt in conventional web/backend deployments and provide a real second implementation against which the persistence contract can be pressure-tested.

This sprint deliberately does not add MongoDB, MySQL, Redis, Supabase, Firebase, or infrastructure adapters. One adapter remains the unit of delivery.

## Architecture and code impact

Expected changes are isolated around the server persistence boundary and a PostgreSQL-specific entry point/package surface. The existing SQLite behavior remains the semantic reference.

Planned architectural rules:

- Preserve existing `PersistenceAdapter`/durable-authority contracts wherever they are sufficient.
- Do not leak PostgreSQL-specific concepts into browser/core state APIs.
- Keep the PostgreSQL driver out of generic/browser entry points and make it an explicit server-side dependency/peer where appropriate.
- Use database transactions for state + durable-event + idempotency atomicity.
- Enforce compare-and-set/version correctness in PostgreSQL rather than relying on process-local locking.
- Preserve partition/topic/store-key semantics, tombstones, replay ordering, and idempotent retries.
- Keep legacy/unscoped partition behavior compatible with current persistence semantics.
- If the existing persistence contract cannot express a required operation cleanly, make the smallest generic core/server enhancement justified by both SQLite and PostgreSQL rather than adding adapter-specific hooks.

Likely touched areas: server persistence interfaces/types, server export map, PostgreSQL implementation and schema/bootstrap code, package metadata, focused persistence tests, integration tests, and adapter documentation. Existing React, Angular, Express, Elysia, gateway, transport, and client APIs should not require behavioral changes.

## Compatibility and regression risks

Primary risks:

- SQL transaction boundaries accidentally diverging from SQLite's accepted-event semantics.
- Race conditions around concurrent compare-and-set mutations.
- Idempotency races when two workers retry the same logical mutation.
- Event ordering/replay differences caused by PostgreSQL-generated identifiers.
- JSON serialization differences, especially `null`/tombstones and structured values.
- Schema initialization/migration behavior under concurrent startup.
- Connection/client lifecycle leaks in tests or server shutdown.
- Pulling a Node-only PostgreSQL dependency into browser/Bun-neutral entry points.

Compatibility target: no breaking changes to existing public client/framework APIs and no behavior regression in SQLite/reference persistence tests.

## Weekly task breakdown

### Sunday — planning

- [x] Inspect current roadmap and package inventory.
- [x] Confirm no PostgreSQL adapter/package already exists.
- [x] Review durable-authority semantics and SQLite's role as reference implementation.
- [x] Create dedicated sprint branch before sprint documentation changes.
- [x] Define scope, architecture constraints, risks, QA strategy, and deadline assessment.

### Monday — contract and skeleton

- [ ] Inspect persistence interfaces and SQLite implementation/tests in detail.
- [ ] Decide PostgreSQL client abstraction/dependency strategy with minimal API surface.
- [ ] Add PostgreSQL adapter skeleton, isolated server export, schema/bootstrap path, and type-level tests/build coverage.
- [ ] Add initial adapter documentation/example configuration.

### Tuesday — authoritative state transactions

- [ ] Implement state reads/snapshots and transactional compare-and-set mutation path.
- [ ] Implement durable tombstones and partition/store-key constraints.
- [ ] Add focused success, version-conflict, rollback, and serialization tests.

### Wednesday — idempotency and durable event log

- [ ] Implement partition-scoped idempotency and atomic event append.
- [ ] Implement ranged replay/event ordering and snapshot compatibility.
- [ ] Test duplicate retries, concurrent retries, restart/reconnect recovery, and ordering.

### Thursday — compaction, lifecycle, failure behavior

- [ ] Implement retention/compaction operations required by the persistence contract.
- [ ] Verify connection lifecycle and schema initialization behavior.
- [ ] Add failure-injection tests for transaction rollback/database errors and regression coverage against reference semantics.

### Friday — integration and hardening

- [ ] Run focused integration suite against PostgreSQL where the environment permits.
- [ ] Run full repository verification and fix regressions.
- [ ] Review API surface, dependency boundaries, edge cases, typing, docs, and package/build behavior as senior-dev/QA pass.
- [ ] Prepare any required changeset/version metadata, but do not version-bump merely for planning.

### Saturday — release-candidate QA and PR

- [ ] Complete remaining fixes.
- [ ] Run full relevant unit/integration/regression/build/lint/capacity verification.
- [ ] Update README, ROADMAP, compatibility/operations docs and this sprint record with actual evidence.
- [ ] Finalize version/dependency metadata only if required by repository release convention.
- [ ] Push final branch state and create PR with scope, architecture impact, compatibility notes, and test evidence.
- [ ] Inspect GitHub Actions; diagnose/fix failures on this branch until green or record an exact external blocker.
- [ ] Do not merge the PR.

## Daily progress log

### Sunday — 2026-09-06

Planning completed. Repository inspection found five current packages (`zuno`, React, Angular, Express, Elysia) and no database adapter package. The roadmap marks Milestones 1–13 complete and explicitly lists additional persistence adapters as later product expansion. The existing durable-authority documentation establishes SQLite WAL as the reference implementation and requires atomic state/log transactions, partition-scoped idempotency, durable tombstones, replay/compaction, and restart recovery. PostgreSQL was selected as the first adapter because it provides the highest-impact conventional production database target while exercising those semantics against a real multi-process database.

No implementation code or package/version changes were made on Sunday, by design.

## QA / test checklist

- [ ] Existing SQLite persistence tests remain green.
- [ ] PostgreSQL schema/bootstrap is deterministic and safe to repeat.
- [ ] Read/write round-trip preserves supported JSON state.
- [ ] Compare-and-set accepts the expected version and rejects stale versions atomically.
- [ ] Rejected mutation appends no durable event.
- [ ] Idempotency retry returns the original accepted event without duplicate state/log changes.
- [ ] Concurrent idempotency attempts cannot double-apply.
- [ ] Tombstones remain replayable according to retention semantics.
- [ ] Replay is ordered and partition-scoped.
- [ ] Snapshot/restart recovery reconstructs authoritative state correctly.
- [ ] Compaction respects normal-event and tombstone retention rules.
- [ ] Database failure/rollback cannot leave state and log inconsistent.
- [ ] PostgreSQL dependency is absent from browser/generic entry points.
- [ ] Type declarations and package exports build correctly.
- [ ] Full repository unit/regression verification passes.
- [ ] Existing capacity smoke verification remains green.

## CI status

Not applicable yet. Sunday contains planning documentation only. CI will become authoritative after implementation commits and the sprint PR are available.

## Documentation / versioning status

Sprint plan created. README/ROADMAP/compatibility/operations documentation and release metadata are intentionally deferred until implementation behavior is known. No version bump is justified on planning day.

## Blockers

None identified during planning. A real PostgreSQL integration environment may be required for final integration evidence; if CI/repository infrastructure does not provide one, the adapter will use unit/failure-contract coverage plus whatever reproducible local/container integration mechanism fits existing project conventions, and the missing environment will be reported rather than hidden.

## Deadline assessment

**Saturday is realistic with moderate implementation risk.** Zuno already has a mature durable-persistence contract and SQLite reference semantics, so this is primarily a second implementation rather than a new state model. The schedule remains realistic if the public persistence contract is sufficiently database-neutral and PostgreSQL integration can be exercised reproducibly. The largest schedule risks are discovering SQLite-specific assumptions in the contract or lacking an executable PostgreSQL integration environment. Any large generic persistence redesign will be treated as a blocker/core milestone candidate rather than rushed into this adapter.

## Final outcome

Pending Saturday completion and CI evidence.