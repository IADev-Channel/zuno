# PostgreSQL Package Extraction Sprint — 2026-09-20 to 2026-09-22

## Sprint identity
- Adapter: `@iadev93/zuno-postgresql`
- Category: Database / durable persistence
- Branch: `adapter/postgresql-package-2026-09-20`
- Target dates: 2026-09-20 through 2026-09-22
- Status: Extraction implemented; executable proof remains release-blocking

## Executive decision frame
- **PROBLEM:** PostgreSQL-specific SQL and transaction behavior had leaked into Core, making a universal package own a database implementation.
- **CUSTOMER:** Server-side Zuno adopters who need durable multi-process authority on PostgreSQL; Core users also benefit from not carrying irrelevant database surface.
- **OUTCOME:** Core owns a stable async persistence contract; PostgreSQL becomes independently installable and evolvable.
- **PRIORITY:** Finish the existing two-week PostgreSQL investment cleanly before performance work; do not compound boundary debt.
- **COST:** Small package/CI/documentation overhead now; lower future adapter coupling and regression blast radius.
- **RISK:** Public-contract insufficiency, workspace/build breakage, and unproven concurrency semantics.
- **ALTERNATIVES:** Keep PostgreSQL in Core (simpler packaging, worse long-term boundary); abandon PostgreSQL (wastes useful work); use only SQLite (insufficient for common distributed/server deployments).
- **DECISION:** Extract PostgreSQL; retain only generic async persistence/orchestration in Core.
- **SUCCESS METRICS:** zero PostgreSQL implementation/export/build entry in Core; adapter imports only public Core APIs; package builds/types; real PostgreSQL concurrency/failure suite passes; repository CI green.

## Architecture / code impact
Core retains `ZunoAsyncServerPersistence`, `AsyncZunoServerState`, generic persistence semantics and built-in SQLite. PostgreSQL implementation/schema/CAS/idempotency/advisory locking/replay/compaction move to `packages/zuno-postgresql`, consuming `@iadev93/zuno` and `@iadev93/zuno/server` public surfaces only.

## Monday progress
- [x] Inspected existing workspace package conventions.
- [x] Created `packages/zuno-postgresql` with package metadata, TypeScript and tsup build configuration.
- [x] Moved PostgreSQL implementation to adapter source and changed imports to public Zuno package contracts.
- [x] Removed `./server/postgres` from Core package exports.
- [x] Removed PostgreSQL from Core server barrel and tsup entries.
- [x] Deleted PostgreSQL implementation from Core source.
- [ ] Add real PostgreSQL integration harness/driver coverage.
- [ ] Execute package/core build, typecheck, lint and regression suite.
- [ ] Execute concurrency/idempotency/rollback/reconnect/replay/compaction against live PostgreSQL.

## QA / release gates
- [x] Structural package separation is implemented.
- [x] Core no longer publicly exports/builds PostgreSQL implementation.
- [x] Adapter depends on public Core contract rather than relative Core internals.
- [ ] SQLite/core regression suite green.
- [ ] PostgreSQL schema initializes against a real database.
- [ ] CAS state+event atomicity and stale-CAS rollback proven.
- [ ] Concurrent first-write and duplicate-idempotency races proven.
- [ ] Disconnect/reconnect and rollback failure behavior proven.
- [ ] Replay/snapshot/compaction/tombstone semantics proven.
- [ ] BIGINT boundaries proven.
- [ ] Adapter ESM/CJS/declarations/package install verified.
- [ ] GitHub Actions green.

## CI status
Not yet eligible to claim green. This branch now has meaningful implementation commits, but a PR/CI run should be created only after the live-test harness and repository wiring are ready; otherwise CI would validate packaging without validating the principal database correctness risk.

## Documentation / versioning
Package metadata exists at initial adapter version `0.1.0`; release-facing README/roadmap/changeset remain gated on executable proof. No release-readiness claim is made.

## Blockers
The remaining blocker is executable evidence, especially a real PostgreSQL service/driver environment. The GitHub connector can mutate and inspect the repository but cannot itself execute Node/PostgreSQL. If CI is wired with a PostgreSQL service, that becomes the preferred repeatable proof path.

## Executive learning log
1. **WHAT WE LEARNED:** A plugin boundary is valuable only if implementation dependencies point inward through a public contract; a folder named `postgres` inside Core is not an adapter architecture.
2. **WHY IT MATTERS TO USERS:** Users install only the persistence technology they need and Core behavior is less likely to change because of database-specific work.
3. **WHY IT MATTERS TO THE BUSINESS:** Lower coupling reduces future adapter delivery cost and makes the ecosystem extensible by contributors rather than only the Core team.
4. **ARCHITECTURE/THEORY:** Dependency inversion: policy/contract belongs to Core; database mechanism belongs at the edge. PostgreSQL advisory locks serialize authority races across processes, but correctness still needs live proof.
5. **COST & ECONOMICS:** One extra package adds release/CI overhead, but avoids multiplying database-specific maintenance inside the highest-blast-radius package.
6. **RISK & FAILURE MODE:** A clean package boundary can create false confidence if transaction, lock and recovery semantics are only statically reviewed.
7. **MANAGEMENT LESSON:** Correct boundary debt before starting the next roadmap item; freeze feature scope while closing verification.
8. **FOUNDER/ENTREPRENEUR LESSON:** Ecosystem breadth is not advantage by itself. A stable extension contract that lets others add integrations is leverage.
9. **WHAT WE WOULD DELEGATE:** Package boilerplate, repetitive compatibility tests and documentation assembly; retain architecture boundary and concurrency acceptance criteria at senior/CTO ownership.
10. **WHAT WE WOULD MEASURE:** Core dependency/surface growth, adapter install/build success, transaction correctness under contention, DB operations per mutation, regression count, CI duration and maintenance effort.
11. **KEYPOINTS TO REMEMBER:** contract in Core; mechanism at edge; package separation is not proof; concurrency requires database-level testing; stop adding features until release gates pass.

**CEO — Does this create enough value to deserve resources?** Yes, because it protects Core while preserving a high-value PostgreSQL capability; cap the remaining investment at verification/defect closure.

**FOUNDER — Does this strengthen product-market advantage or validate an assumption?** It strengthens extensibility, but PostgreSQL demand/adoption still needs validation after release.

**CTO — Is this the simplest architecture that meets the required scale/reliability?** Yes at the boundary level: one generic async contract plus one external adapter; avoid introducing a plugin framework or ORM abstraction.

**MANAGER — Is the team solving the right problem with clear ownership and success criteria?** Yes. Remaining ownership is QA/verification, not new feature development.

## Daily progress log
### 2026-09-20 — Sunday
Created continuation branch from PR #10 head and locked the contract-in-Core / PostgreSQL-in-adapter decision.

### 2026-09-21 — Monday
Implemented the package boundary: standalone `@iadev93/zuno-postgresql`, public-contract imports, and removal of PostgreSQL implementation/export/build entry from Core. Did not claim executable correctness. Remaining work is live PostgreSQL integration proof, repository verification, defects, CI and release documentation.

## Final outcome
Pending. Structural extraction is complete; release correctness is not yet proven. After proof and closure, move to sync/SSE efficiency and write/network amplification rather than another adapter immediately.
