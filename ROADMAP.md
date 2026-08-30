# Zuno Roadmap

Last reviewed: 2026-08-31

This roadmap tracks Zuno's path from an experimental distributed-state engine to a production-ready library. Update the checkboxes and review date whenever a milestone changes.

Current verified package versions:

- `@iadev93/zuno@0.1.0`
- `@iadev93/zuno-react@0.0.16`
- `@iadev93/zuno-angular@0.2.0`
- `@iadev93/zuno-express@0.0.16`
- `@iadev93/zuno-elysia@0.0.12`

Current verification baseline: 67 tests pass, Biome passes, and all five packages build with TypeScript declarations.

## Status Legend

- [x] Complete
- [ ] Planned
- **In progress**: active milestone

## Milestone 1: Green Release Pipeline — Complete

- [x] Fix Angular declaration generation.
- [x] Align Angular with a compatible TypeScript version.
- [x] Fix Biome errors and migrate its configuration to the installed schema.
- [x] Add a non-interactive `pnpm test` command.
- [x] Add a single `pnpm verify` command covering lint, tests, and all package builds.
- [x] Add GitHub Actions verification for pushes and pull requests.
- [x] Validate npm package contents with publication dry-runs.
- [x] Publish the verified package set:
  - `@iadev93/zuno@0.0.10`
  - `@iadev93/zuno-react@0.0.13`
  - `@iadev93/zuno-angular@0.0.2`
  - `@iadev93/zuno-express@0.0.12`
  - `@iadev93/zuno-elysia@0.0.7`

Completion evidence: 38 tests pass, Biome passes, and all five packages build with declarations.

## Milestone 2: Synchronization Correctness — Complete

- [x] Send the authoritative `baseVersion` with optimistic mutations.
- [x] Send `baseVersion` when optimistic updates are disabled.
- [x] Preserve the first authoritative `baseVersion` when batching same-store updates.
- [x] Add regression tests for normal, non-optimistic, and batched versioning.
- [x] Fix snapshot-cache invalidation after restore, delete, clear, and restored-store updates.
- [x] Connect the Angular example to the shared Elysia demo universe.

## Milestone 3: Server Isolation and Validation — Complete

- [x] Replace process-global server state, event log, and listeners with isolated server instances.
- [x] Keep the current adapter APIs usable and retain backward-compatible module-level helpers.
- [x] Add a lazy registry for namespace or tenant isolation.
- [x] Validate incoming event structure, including `storeKey`, state, versions, and intent fields.
- [x] Enforce raw payload and serialized-state size limits consistently across adapters.
- [x] Add authentication and authorization hooks without coupling core to a provider.
- [x] Add tests proving that two server instances cannot read or publish each other's state.
- [x] Document the server lifecycle and isolation model.

Completion criteria: isolated instances pass adapter integration tests, invalid events are rejected consistently, and existing consumers have a clear compatibility path.

## Milestone 4: Replay and Transport Resilience — Complete

- [x] Detect event-log replay gaps and send a full snapshot when the requested event is no longer retained.
- [x] Stop scheduled SSE reconnections after `stop()`.
- [x] Remove browser event listeners during cleanup.
- [x] Add bounded retry and backoff behavior for network and conflict failures.
- [x] Preserve retryable events on HTTP 5xx responses.
- [x] Add queue and SSE-client buffer limits for backpressure protection.
- [x] Add a pluggable offline queue with an IndexedDB implementation.
- [x] Test reconnects, replay truncation, process restart, slow subscribers, and cleanup.

Delivered in the `0.0.13` core release: replay-gap snapshot recovery, event-ID snapshots, bounded client retries and queues, durable IndexedDB queue storage, per-store final-state coalescing, bounded subscriber buffers, reliable cleanup, and retryable HTTP 5xx handling.

Completion criteria: interruption and recovery scenarios converge deterministically without leaking listeners or silently losing retryable mutations.

## Milestone 5: Persistence and Multi-Process Operation — Complete

- [x] Define persistence and event-log adapter contracts.
- [x] Ship an in-memory adapter for development and tests.
- [x] Add at least one durable reference adapter.
- [x] Define atomic compare-and-set requirements for version updates.
- [x] Support multiple server processes through a shared event bus.
- [x] Add crash/restart and concurrent-server integration tests.

Completion criteria: state and replay survive restarts, and multiple server processes preserve the documented conflict semantics.

## Milestone 6: Packaging and Release Automation

- [x] Add clean ESM and CommonJS consumer fixtures for every package.
- [x] Test packed tarballs by installing them into the consumer fixtures.
- [x] Normalize package exports and supported runtime metadata.
- [x] Add Node.js and Bun compatibility matrices to CI.
- [x] Adopt Changesets or an equivalent coordinated release workflow.
- [x] Automate npm publishing with provenance and protected release approval.
- [x] Generate release notes and tags from the release workflow.

The release workflow is implemented and locally verified. Publishing becomes active after the repository's `npm` environment is configured with required reviewers and an `NPM_TOKEN` secret.

Completion criteria: a tagged release can be built, tested, packed, and published reproducibly from CI.

## Milestone 7: Dependency and Framework Upgrades — Complete

- [x] Upgrade patch and minor dependencies first.
- [x] Upgrade Angular one major version at a time and test its adapter/example at each step.
- [x] Upgrade Analog and Vite with their matching Angular compatibility requirements.
- [x] Test TypeScript upgrades in CI before changing the supported compiler range.
- [x] Upgrade Node.js type definitions based on the declared runtime support policy.
- [x] Remove deprecated Angular dependencies where the modern bootstrap path no longer needs them.

Delivered with Angular 20 and 21 migration checkpoints followed by the verified
Angular 22.1, Analog 2.7, Vite 8.2, and TypeScript 6.0 stack. Core, React,
Express, and Elysia are additionally checked with stable TypeScript 7.0 while
TypeScript 6 remains as Angular's compiler and the declaration-bundling bridge. The standalone
example no longer installs legacy animation, dynamic-platform, or CLI packages;
the adapter tests use Angular's modern browser testing platform. Supported
ranges and the upgrade policy are documented in `docs/compatibility.md`.

Completion criteria: supported dependency ranges are documented, tested, and free of known framework compatibility conflicts.

## Milestone 8: Product Readiness — Complete

- [x] Align all documentation on the consistency claim: optimistic, server-authoritative eventual consistency with version-based conflict detection.
- [x] Add observable connection, queue, retry, and conflict status APIs.
- [x] Add connection-status indicators to every browser example.
- [x] Add a single documented demo command and topology diagram.
- [x] Add structured logging and metrics hooks.
- [x] Publish security, support, and compatibility policies.
- [x] Benchmark realistic multi-client workloads and document the results.

Delivered with the public `status` observable, structured `onLog` and `onMetric`
hooks, operational indicators in HTML/React/Angular, one-command demo topology,
security/support/compatibility policies, and a reproducible 100-client benchmark.

Completion criteria: users can understand, operate, monitor, and troubleshoot Zuno without reading its source.

## Later Expansion

These should start only after the production-readiness milestones above:

- [ ] Vue adapter
- [ ] Svelte adapter
- [ ] WebSocket transport
- [ ] Developer tools and event timeline
- [ ] Additional persistence adapters
- [ ] Cross-language Protocol v1 implementations

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-08-26 | Use Elysia on port 3002 as the shared multi-framework demo server. | Running Express and Elysia simultaneously creates separate in-memory universes. |
| 2026-08-26 | Pin Angular 19 workspaces to TypeScript 5.8.3. | Angular 19 rejects TypeScript 5.9 and later. |
| 2026-08-26 | Prioritize server isolation before adding more framework adapters. | Process-global state prevents safe tenant and instance isolation. |
| 2026-08-26 | Use retained SSE replay for short interruptions and authoritative snapshots for replay gaps. | Clients recover efficiently when possible and still converge when their requested history has expired. |
| 2026-08-30 | Isolate Angular on TypeScript 6 and check non-Angular packages with TypeScript 7. | Angular 22 requires TypeScript 6 while the stable native compiler is ready for core and the other adapters. |
| 2026-08-30 | Define the product claim as optimistic, server-authoritative eventual consistency. | Version checks detect stale writes, but replicas converge asynchronously and are not linearizable. |
