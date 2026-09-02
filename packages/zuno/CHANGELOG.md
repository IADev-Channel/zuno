# @iadev93/zuno

## 0.2.0

### Minor Changes

- Add the Milestone 10 durable-authority APIs: SQLite WAL persistence, atomic idempotent mutations, granular replay and compaction, tombstones, ephemeral events, and partition-aware event-bus offsets.

## 0.1.0

### Minor Changes

- 841d292: Add observable connection, queue, retry, and conflict status plus structured
  logging and metrics hooks. Expose the operational status contract through the
  Angular service.

## 0.0.16

### Patch Changes

- Upgrade the supported framework and compiler toolchains for Milestone 7. Angular
  now targets Angular 22 with TypeScript 6, while core, React, Express, and Elysia
  are checked with the stable TypeScript 7 native compiler.

## 0.0.15

### Patch Changes

- 81911c5: Normalize ESM and CommonJS exports, declare Node.js 22 and later support, and verify the packed packages in clean consumer projects.
