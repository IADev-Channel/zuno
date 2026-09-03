# @iadev93/zuno-elysia

## 0.2.1

### Patch Changes

- Updated dependencies [516cbdd]
  - @iadev93/zuno@0.4.1

## 0.2.0

### Minor Changes

- 52c911d: Add configurable mutation batching, compact state deltas, gzip thresholds,
  shared browser SSE ownership, optional WebSocket downstream support, and
  transport byte and gateway fan-out telemetry. Cross-tab snapshots retain only
  server-confirmed state and versions so stale optimistic tabs cannot overwrite a
  fresh authoritative snapshot.

### Patch Changes

- Updated dependencies [52c911d]
  - @iadev93/zuno@0.4.0

## 0.1.0

### Minor Changes

- df3e736: Add the Milestone 11 connection gateway contract, bounded horizontal fan-out, graceful draining, authenticated connection limits, configurable heartbeats, slow-consumer resynchronization, and jittered reconnect behavior. Express and Elysia can now share a gateway and authenticated principal resolver.

### Patch Changes

- Updated dependencies [df3e736]
  - @iadev93/zuno@0.3.0

## 0.0.13

### Patch Changes

- Updated dependencies
  - @iadev93/zuno@0.2.0

## 0.0.12

### Patch Changes

- Updated dependencies [841d292]
  - @iadev93/zuno@0.1.0

## 0.0.11

### Patch Changes

- Upgrade the supported framework and compiler toolchains for Milestone 7. Angular
  now targets Angular 22 with TypeScript 6, while core, React, Express, and Elysia
  are checked with the stable TypeScript 7 native compiler.
- Updated dependencies
  - @iadev93/zuno@0.0.16

## 0.0.10

### Patch Changes

- 81911c5: Normalize ESM and CommonJS exports, declare Node.js 22 and later support, and verify the packed packages in clean consumer projects.
- Updated dependencies [81911c5]
  - @iadev93/zuno@0.0.15
