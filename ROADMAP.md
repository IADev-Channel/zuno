# Zuno Roadmap

Last reviewed: 2026-08-31

This roadmap tracks Zuno's path from an experimental distributed-state engine to a production-ready library. Update the checkboxes and review date whenever a milestone changes.

Current verified package versions:

- `@iadev93/zuno@0.1.0`
- `@iadev93/zuno-react@0.0.16`
- `@iadev93/zuno-angular@0.2.0`
- `@iadev93/zuno-express@0.0.16`
- `@iadev93/zuno-elysia@0.0.12`

Current verification baseline: 67 tests pass, Biome passes, and all five packages build with TypeScript declarations. Milestone 9 adds focused subscription/partition protocol coverage; branch CI is the authoritative verification record.

## Status Legend

- [x] Complete
- [ ] Planned
- **In progress**: active milestone

## Milestones 1–8 — Complete

Milestones 1–8 delivered the green release pipeline, synchronization correctness, server isolation/validation, replay/transport resilience, persistence/multi-process operation, packaging/release automation, framework upgrades, and product readiness. See git history for their detailed completion records.

## Scale Objective: 200,000 Concurrent Connections

The target means 200,000 simultaneously connected clients across a distributed deployment, not 200,000 clients subscribed to one global event stream. Zuno must not claim this capacity until a versioned workload profile and repeatable load test demonstrate it.

## Milestone 9: Subscription and Partitioning Protocol — Complete

- [x] Add stable `ZunoTopic`, `ZunoPartitionKey`, and subscription identifier types.
- [x] Add subscribe, unsubscribe, and replace-subscriptions operations to the client transport contract.
- [x] Scope mutation events, replay cursors, and snapshots to an authorized partition and topic set.
- [x] Reject cross-tenant store keys and subscription escalation before state access.
- [x] Replace global server listener fan-out with indexed topic/partition subscriber registries for subscription-aware clients while retaining the legacy protocol compatibility path.
- [x] Route one accepted mutation only to subscribers whose topic set matches it.
- [x] Add subscription limits per connection and topic-membership limits per principal.
- [x] Add protocol compatibility/version negotiation for clients that do not support subscriptions.
- [x] Test tenant isolation, subscription churn, unauthorized topics, replay, and snapshot recovery.

Delivered with Protocol v1 subscription negotiation, branded partition/topic identifiers, scoped store keys, principal authorization, bounded subscriptions, indexed fan-out, scoped replay/snapshots, and legacy Protocol v0 fallback.

Completion criteria: delivery work for Protocol v1 scales with matching recipients rather than all connected clients, and focused tests prove partitions cannot observe each other's scoped state or events.

## Milestone 10: Production Authority and Durable Event Log — Complete

- [x] Add a production database persistence adapter with transactional compare-and-set semantics.
- [x] Store state by partition and store key with a database-enforced version constraint.
- [x] Add idempotency keys so retried mutation batches cannot be applied twice.
- [x] Replace whole-log load/save operations with append, ranged replay, snapshot, and compaction methods.
- [x] Define retention, tombstone, compaction, and partition-migration behavior.
- [x] Separate ephemeral presence/cursor events from durable authoritative state mutations.
- [x] Add a partition-aware event-bus contract with consumer offsets and duplicate-delivery handling.
- [x] Add database and event-bus failure-injection tests, including partial failure and restart recovery.
- [x] Benchmark realistic payload sizes and hot-partition contention against the production adapter.

Delivered with a SQLite WAL authority adapter, atomic state-and-log transactions, partition-scoped idempotency, granular replay/snapshot/compaction APIs, durable tombstones, live-only ephemeral events, partition offsets, injected failure recovery tests, and a realistic hot-partition benchmark. Operational retention and partition-migration rules are documented in `docs/durable-authority.md`.

Completion criteria: authoritative state and replay survive process or node loss, duplicate delivery is safe, and no mutation relies on process-local memory for correctness.

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

## Milestone 12: Traffic and Connection Efficiency

- [ ] Add mutation batching, configurable batching, delta/intent optimization, compression thresholds, browser connection sharing, optional WebSocket transport, SSE/HTTP interoperability, and byte/fan-out telemetry.

## Milestone 13: Capacity Validation and Operational Readiness

- [ ] Add the distributed load-test harness and require the published 200k workload/SLO suite to pass before making a 200k support claim.

## Later Product Expansion

- [ ] Vue adapter
- [ ] Svelte adapter
- [ ] Developer tools and event timeline
- [ ] Additional persistence adapters beyond the production reference
- [ ] Cross-language Protocol v1 implementations

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-08-31 | Define 200k as a measured distributed-connection target, not one global broadcast domain. | Connection count alone is insufficient; fan-out, write rate, payload size, reconnects, and SLOs determine capacity. |
| 2026-08-31 | Prioritize subscriptions, partitioning, durable authority, and gateways before adding transports or UI adapters. | WebSockets do not solve global fan-out, persistence contention, or single-process connection ownership. |
| 2026-08-31 | Introduce Protocol v1 scoped subscriptions while retaining Protocol v0 compatibility. | New clients need partition/topic isolation without abruptly breaking existing consumers. |
