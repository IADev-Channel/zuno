# Operations and Demo Topology

Zuno provides optimistic, server-authoritative eventual consistency with
version-based conflict detection. Local state can update immediately, but the
server's accepted version is authoritative and replicas converge through SSE
events, replay, or snapshot recovery.

## Run the complete demo

```bash
pnpm start
```

This single command starts all examples. The browser clients display connection,
queue, retry, and conflict state. The Elysia service on port 3002 is authoritative
for HTML, React, and Angular; the Express service on port 3003 is intentionally
an isolated adapter exercise.

```mermaid
flowchart LR
  HTML["HTML client"] -->|POST mutations| E["Elysia authority :3002"]
  React["React client"] -->|POST mutations| E
  Angular["Angular client"] -->|POST mutations| E
  E -->|SSE events / replay / snapshots| HTML
  E -->|SSE events / replay / snapshots| React
  E -->|SSE events / replay / snapshots| Angular
  Express["Express exercise :3003"] --> Own["Independent durable authority"]
```

## Observable status

Every Zuno instance exposes `status.get()` and `status.subscribe(listener)`.
The snapshot contains `connection`, `queuedMutations`, `retryAttempt`,
`conflictCount`, and optional `lastError`.

## Structured telemetry

Pass `onLog` and `onMetric` to `createZuno`. Logs contain a stable event name,
level, timestamp, and structured details. Metrics contain a name, numeric value,
unit, timestamp, and optional tags. Hooks should enqueue work rather than block
the transport or throw.
