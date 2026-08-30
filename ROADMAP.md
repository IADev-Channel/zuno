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

## Scale Objective: 200,000 Concurrent Connections

The target means 200,000 simultaneously connected clients across a distributed
deployment, not 200,000 clients subscribed to one global event stream. Zuno must
not claim this capacity until a versioned workload profile and repeatable load
test demonstrate it.

The reference workload must define connected versus active clients, subscriptions
per connection, mutations per active client, recipients per mutation, event size,
idle percentage, regional distribution, reconnect rate, and acceptable latency,
error, conflict, and recovery thresholds.

## Milestone 9: Subscription and Partitioning Protocol

- [ ] Add stable `ZunoTopic`, `ZunoPartitionKey`, and subscription identifier types.
- [ ] Add subscribe, unsubscribe, and replace-subscriptions operations to the client transport contract.
- [ ] Scope mutation events, replay cursors, and snapshots to an authorized partition and topic set.
- [ ] Reject cross-tenant store keys and subscription escalation before state access.
- [ ] Replace global server listener fan-out with indexed topic/partition subscriber registries.
- [ ] Route one accepted mutation only to subscribers whose topic set matches it.
- [ ] Add subscription limits per connection and topic-membership limits per principal.
- [ ] Add protocol compatibility/version negotiation for clients that do not support subscriptions.
- [ ] Test tenant isolation, subscription churn, unauthorized topics, replay, and snapshot recovery.

Completion criteria: delivery work scales with matching recipients rather than
all connected clients, and tests prove that partitions cannot observe each
other's state or events.

## Milestone 10: Production Authority and Durable Event Log

- [ ] Add a production database persistence adapter with transactional compare-and-set semantics.
- [ ] Store state by partition and store key with a database-enforced version constraint.
- [ ] Add idempotency keys so retried mutation batches cannot be applied twice.
- [ ] Replace whole-log load/save operations with append, ranged replay, snapshot, and compaction methods.
- [ ] Define retention, tombstone, compaction, and partition-migration behavior.
- [ ] Separate ephemeral presence/cursor events from durable authoritative state mutations.
- [ ] Add a partition-aware event-bus contract with consumer offsets and duplicate-delivery handling.
- [ ] Add database and event-bus failure-injection tests, including partial failure and restart recovery.
- [ ] Benchmark realistic payload sizes and hot-partition contention against the production adapter.

Completion criteria: authoritative state and replay survive process or node loss,
duplicate delivery is safe, and no mutation relies on process-local memory for
correctness.

## Milestone 11: Connection Gateway and Horizontal Fan-Out

- [ ] Extract SSE connection ownership from framework request handlers into a gateway contract.
- [ ] Make gateways stateless apart from bounded connection/subscription indexes.
- [ ] Route accepted events from the shared bus only to gateways with matching subscribers.
- [ ] Add gateway registration, health, draining, and graceful deployment behavior.
- [ ] Add per-principal connection limits and authenticated connection metadata.
- [ ] Add configurable heartbeat intervals aligned with proxy/load-balancer idle timeouts.
- [ ] Implement slow-consumer eviction with a typed `RESYNC_REQUIRED` control event.
- [ ] Add reconnect jitter and admission control to prevent reconnect storms.
- [ ] Add regional routing and document the single-writer/partition-leader policy.
- [ ] Prove that adding gateways increases connection capacity without changing conflict semantics.

Completion criteria: connections can be distributed across gateway instances,
deployments drain without a synchronized reconnect spike, and slow clients
recover through replay or scoped snapshots.

## Milestone 12: Traffic and Connection Efficiency

- [ ] Add a mutation-batch protocol with per-item results and one idempotency key per batch.
- [ ] Add configurable time/count batching for high-frequency client mutations.
- [ ] Prefer intents or deltas where safe instead of repeatedly transmitting full state.
- [ ] Add payload compression thresholds and measure CPU versus bandwidth tradeoffs.
- [ ] Add browser leader election or SharedWorker support for one remote connection across same-origin tabs.
- [ ] Deduplicate identical subscriptions and snapshots within a browser session.
- [ ] Add an optional WebSocket transport for bidirectional high-frequency workloads.
- [ ] Keep SSE plus HTTP as the low-frequency default and verify transport interoperability.
- [ ] Add byte, request, batch-size, and fan-out metrics to the public telemetry hooks.

Completion criteria: the documented workload stays within its request, bandwidth,
CPU, and memory budgets, and multiple tabs do not require one server connection
each when platform support permits sharing.

## Milestone 13: Capacity Validation and Operational Readiness

- [ ] Add a distributed load-test harness that opens real SSE and WebSocket connections.
- [ ] Version the 200k reference workload and publish the exact infrastructure topology.
- [ ] Test ramp-up, steady state, burst writes, reconnect storms, gateway loss, and bus/database degradation.
- [ ] Measure p50/p95/p99 mutation acknowledgement and event-delivery latency.
- [ ] Measure connections per gateway, memory per connection, CPU, bandwidth, queue depth, and dropped/resynced clients.
- [ ] Define SLOs and alerts for availability, delivery latency, conflicts, retries, lag, and reconnect rate.
- [ ] Add load shedding, mutation rate limits, circuit breakers, and per-tenant quotas.
- [ ] Run soak tests long enough to expose connection, listener, timer, and buffer leaks.
- [ ] Publish capacity results with costs and explicitly document unsupported workload shapes.
- [ ] Require the distributed test to pass before making a 200k-concurrency support claim.

Completion criteria: 200,000 concurrent connections pass the published workload
and SLOs with no correctness failures, unbounded queues, global fan-out, or
single-process dependency.

## Later Product Expansion

These remain lower priority than the scale milestones:

- [ ] Vue adapter
- [ ] Svelte adapter
- [ ] Developer tools and event timeline
- [ ] Additional persistence adapters beyond the production reference
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
| 2026-08-31 | Define 200k as a measured distributed-connection target, not one global broadcast domain. | Connection count alone is insufficient; fan-out, write rate, payload size, reconnects, and SLOs determine capacity. |
| 2026-08-31 | Prioritize subscriptions, partitioning, durable authority, and gateways before adding transports or UI adapters. | WebSockets do not solve global fan-out, persistence contention, or single-process connection ownership. |
