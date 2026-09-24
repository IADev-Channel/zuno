# PostgreSQL release-gate recovery — 2026-09-24

## Problem
PR #11 established the intended package boundary but was merged while Verify/Release were failing. CI stops at `pnpm install --frozen-lockfile`, so later build/type/package/database claims are unknown rather than passed.

## Customer
Zuno contributors and consumers who need deterministic installation and trustworthy durable-state guarantees.

## Outcome
Restore reproducible installation, bring `@iadev93/zuno-postgresql` into the repository's actual build/type/package verification surface, and add repeatable live-PostgreSQL correctness evidence before declaring the PostgreSQL milestone complete.

## Priority
P0 closure work. Do not start a new adapter or sync/SSE feature until `main` is reproducible and the PostgreSQL guarantees are executable.

## Cost
Small lockfile/build-plumbing cost plus moderate CI/integration-test cost. This is cheaper than shipping unverified consistency semantics or accumulating more work on a broken baseline.

## Risks
- Mistaking a lockfile repair for database correctness.
- Adding PostgreSQL as a workspace package while root build/type/package scripts silently omit it.
- Flaky concurrency tests that create false confidence.
- Expanding scope into new PostgreSQL features instead of closing release evidence.

## Alternatives
1. Do nothing: rejected; deterministic install remains broken.
2. Revert PostgreSQL: disproportionate unless correctness testing finds architectural defects.
3. Narrow corrective PR: chosen.

## Decision
Create a dedicated recovery branch. First repair dependency reproducibility and repository verification coverage. Then add a PostgreSQL service-backed integration gate for schema initialization, CAS, first-write/idempotency races, rollback/recovery, replay/compaction/tombstones and BIGINT boundaries. No new features.

## Success metrics
- clean `pnpm install --frozen-lockfile` succeeds;
- root build/type/package verification includes `@iadev93/zuno-postgresql`;
- existing Core/SQLite regressions remain green;
- deterministic PostgreSQL integration suite is green;
- corrective PR CI is green before merge.

## Architecture / theory
Core owns persistence policy/contracts; `@iadev93/zuno-postgresql` owns PostgreSQL mechanism. Verification must follow the same boundary: generic CI proves package compatibility while a real PostgreSQL service proves transactional/concurrency behavior. A green generic build cannot substitute for datastore semantics.

## Management
Owner assumption: senior/CTO owns invariants and release criteria; routine lockfile/build wiring and fixture plumbing are delegable. Escalate correctness failures and ambiguous transaction/recovery semantics. Ignore new adapter ideas until closure. Acceptance criteria are executable evidence, not documentation statements.

## Progress
- [x] Confirmed PR #11 merged despite explicit release gate.
- [x] Confirmed main Verify and Release failed after merge.
- [x] Confirmed current root build/type scripts omit `@iadev93/zuno-postgresql`.
- [x] Created `fix/postgresql-release-gates-2026-09-24` from main.
- [ ] Regenerate/fix workspace lockfile.
- [ ] Add PostgreSQL package to root build/type/package verification.
- [ ] Add real PostgreSQL CI service and integration tests.
- [ ] Run full regression/compatibility verification.
- [ ] Open corrective PR and require green CI.

## Executive Learning Log
1. **WHAT WE LEARNED:** architecture correctness and delivery correctness are separate gates; CI that stops at install proves nothing about later guarantees.
2. **WHY IT MATTERS TO USERS:** deterministic installs and concurrency safety are part of the product, not repository housekeeping.
3. **WHY IT MATTERS TO THE BUSINESS:** trust is the scarce asset for state infrastructure; silent correctness gaps are more expensive than missing features.
4. **ARCHITECTURE/THEORY:** evidence must be layered: dependency graph → build/types → package boundary → datastore transactions → concurrency/recovery → operations.
5. **COST & ECONOMICS:** cheap automated gates prevent expensive downstream incidents and support burden.
6. **RISK & FAILURE MODE:** stale lockfile, omitted package verification, stale CAS, first-write/idempotency races, ambiguous commit/recovery and compaction divergence.
7. **MANAGEMENT LESSON:** convert important acceptance criteria into enforced controls; prose-only 'do not merge' rules are weak governance.
8. **FOUNDER/ENTREPRENEUR LESSON:** reliability can differentiate Zuno only when claims are measurable and repeatable.
9. **WHAT WE WOULD DELEGATE:** lockfile regeneration, CI service plumbing, repetitive fixtures and package-install checks.
10. **WHAT WE WOULD MEASURE:** clean-install success, CI pass/flakiness, concurrency invariant pass rate, DB operations/bytes per logical mutation and regression detection time.
11. **KEYPOINTS TO REMEMBER:** green badges need meaningful coverage; unknown is not passed; test guarantees at the boundary that provides them; freeze feature scope during release recovery; automate governance.

### Decision questions
- **CEO — Does this create enough value to deserve resources?** Yes, narrowly: protect prior investment and restore a trustworthy baseline.
- **FOUNDER — Does this strengthen product-market advantage or validate an assumption?** It begins turning reliability from a claim into evidence.
- **CTO — Is this the simplest architecture that meets the required scale/reliability?** Yes; keep the generic contract plus independent adapter, and improve proof rather than redesigning it.
- **MANAGER — Is the team solving the right problem with clear ownership and success criteria?** Yes; closure criteria are now explicit and feature expansion is frozen.
