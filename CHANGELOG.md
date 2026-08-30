# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.14] - 2026-08-30

### Added
- Added authoritative `ZunoServerPersistence` and `ZunoServerEventBus` contracts.
- Added in-memory persistence/bus adapters and a durable atomic file reference adapter.
- Added restart, replay restoration, abandoned-lock recovery, and concurrent-server conflict tests.
- Added durable file persistence to the Express and Elysia server exercises.

### Changed
- Server mutations now perform version validation, state updates, event-ID assignment, and replay-log appends through one atomic `compareAndSet` operation.

## [0.0.13] - 2026-08-30

### Added
- Added a pluggable `ZunoOfflineQueue` contract with in-memory and IndexedDB implementations.
- Added durable mutation recovery across client reloads and explicit `QUEUE_STORAGE_ERROR` reporting.
- Added integration coverage for IndexedDB recovery, reconnect event IDs, replay truncation, server restart snapshots, slow subscribers, and SSE cleanup.
- Added IndexedDB-backed offline recovery to the React, Angular, and Basic HTML exercises.

### Changed
- `createZuno` and `startSSE` now accept an optional `offlineQueue` provider.
- Offline state snapshots are coalesced by store key before flushing, preserving the first `baseVersion` and latest state.
- Milestone 4 verification now covers 61 tests across the full package suite.

## [0.0.12] - 2026-08-26

### Added
- Added replay-gap detection so stale SSE clients receive an authoritative snapshot when the retained event log cannot provide a complete replay.
- Added bounded offline mutation queues (`maxQueueSize`), bounded conflict retries (`maxConflictRetries`), and bounded server subscriber buffers (`maxSubscriberBuffer`).
- Added a replay exercise for testing retained-event recovery and snapshot fallback with the shared Elysia demo.
- Added regression coverage for replay ranges, queue overflow, retryable HTTP 5xx responses, conflict retry limits, reconnection, and cleanup.

### Changed
- SSE snapshots now carry an event ID, allowing clients to resume replay from the snapshot's authoritative position.
- Retryable mutations are retained after HTTP 5xx responses and retried with bounded behavior.
- Raw Node and Elysia SSE connections now protect slow subscribers with bounded buffers.
- Released `@iadev93/zuno@0.0.12` and `@iadev93/zuno-elysia@0.0.9`.

### Fixed
- `stop()` now cancels pending reconnect and flush timers, closes the active EventSource, and removes browser online listeners.
- Automatic conflict resolution no longer retries indefinitely.

## [0.0.11] - 2026-08-26

### Added
- Added isolated `ZunoServerState` instances and a lazy namespace/tenant registry.
- Added provider-agnostic read/write authorization hooks to Express and Elysia adapters.
- Added configurable replay-log and serialized-state size limits.
- Added regression coverage for server isolation, namespaces, validation, limits, and authorization.

### Changed
- Express and Elysia adapters now create isolated server state by default and expose it as `zuno.server`.
- Custom server endpoints can share adapter state by passing the exposed server to `applyStateEvent`.
- Released `@iadev93/zuno@0.0.11`, `@iadev93/zuno-express@0.0.13`, and `@iadev93/zuno-elysia@0.0.8`.

### Fixed
- Malformed events now return consistent validation errors without mutating authoritative state.

## [0.0.10] - 2026-08-26

### Fixed
- Added authoritative `baseVersion` values to optimistic, non-optimistic, and batched mutations so the server can reliably detect concurrent writes.
- Fixed snapshot cache invalidation after universe restore, delete, and clear operations.
- Fixed Angular declaration generation and aligned Angular examples with a compatible TypeScript version.
- Connected the Angular example to the shared Elysia demo universe used by the React and HTML examples.

### Added
- Added regression tests for versioned synchronization and snapshot caching.
- Added a repeatable `pnpm verify` command and GitHub Actions verification workflow.

### Added
- **Angular Adapter**: Official support for Angular 18+ via `@iadev93/zuno-angular`, featuring Signal and Observable bindings.
- **Mutation Batching**: Core engine now coalesces multiple synchronous updates into a single network payload, significantly reducing traffic.
- **Incremental Snapshots**: Universe state serialization is now incrementally cached, improving snapshot performance by ~100x.
- **Custom Equality**: Stores now support a custom `equals` function to skip redundant listener notifications and network syncs.
- **Golden Test Suite**: Comprehensive tests for critical flows including offline queueing (FIFO), conflict resolution determinism, and middleware isolation.
- **Conflict Resolution Strategies**: New documentation and internal support for "Prefer Local", "Prefer Server", and custom manual merge resolvers.
- **Protocol Truth Table**: Detailed documentation of Zuno's synchronization behavior across different network and state conditions.
- **Middleware Support**: Enhanced `createZuno` with onion-style middleware for intercepting and logging events.
- **Architecture Documentation**: Added `ARCHITECTURE.md` explaining the core concepts of Replicas, Universe, and Transport layers.
- **Contributor Guide**: Added `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` to support community growth.
- **Logger Middleware**: Added example logger middleware and conflict resolver to the `basic-html` exercise.

### Fixed
- **Express ESM Compatibility**: Fixed module resolution issues in `@iadev93/zuno-express` by using `.mts` configs.
- **Angular JIT**: Resolved JIT compilation issues in `@iadev93/zuno-angular` for development mode.
- **Type Invariance in Store Management**: Resolved a critical TypeScript error where `Store<T>` could not be assigned to `Store<unknown>` in the internal `Universe` map.
- **Broad Linting Cleanup**: Standardized code style using Biome across all packages, fixing dozens of `noExplicitAny`, `noNonNullAssertion`, and formatting issues.
- **Reactive Hooks**: Cleaned up `useEffect` dependencies in `@iadev93/zuno-react` for better performance and reliability.

### Changed
- **Wire Protocol v1 Refinement**: Improved clarity on event ordering and base versioning for offline reconciliation.
