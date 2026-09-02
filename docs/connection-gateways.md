# Connection Gateways

Milestone 11 separates long-lived connection ownership from authoritative state. A gateway owns only bounded, disposable connection metadata and subscription indexes. State, versions, idempotency, replay, and conflict decisions remain in the shared persistence and partition-aware event bus.

## Creating a gateway

```ts
import {
  createZunoConnectionGateway,
  createZunoServerState,
} from "@iadev93/zuno/server";

const server = createZunoServerState({ persistence, eventBus });
const gateway = createZunoConnectionGateway(server, {
  id: process.env.INSTANCE_ID,
  region: process.env.REGION,
  heartbeatIntervalMs: 15_000,
  healthTimeoutMs: 45_000,
  maxConnections: 10_000,
  maxConnectionsPerPrincipal: 10,
  maxPendingMessages: 1_000,
});
```

Pass the same `gateway` to `createZunoExpress` or `createZunoElysia`. Supply their `principal` callback from authenticated request data. Never trust partition, topic, principal, or region values supplied directly by a client.

Heartbeat intervals must be shorter than every proxy and load-balancer idle timeout on the path. A useful starting point is one third of the shortest idle timeout. Keep `healthTimeoutMs` at least twice the heartbeat interval.

## Deployment lifecycle

1. Register each gateway in service discovery and publish `gateway.health()`.
2. Route new connections only to gateways whose status is `healthy` and preferably in the client's region.
3. Before shutdown, remove the gateway from load-balancer admission and call `gateway.drain()`.
4. Draining sends `RESYNC_REQUIRED`, closes existing streams, and rejects new connections with retry guidance. Clients reconnect with exponential jitter and request a fresh snapshot.
5. Call `gateway.stop()` before process exit and unregister it from discovery.

The in-memory `createMemoryZunoGatewayDirectory` demonstrates registration, health filtering, regional selection, and subscription matching. Production deployments should implement the same discovery behavior with their control plane.

## Slow consumers and reconnect storms

When a response becomes backpressured, the gateway queues at most `maxPendingMessages`. Overflow emits the typed `RESYNC_REQUIRED` control event and evicts that connection. A reconnect discards its old cursor and receives an authoritative snapshot, so dropping the connection cannot change conflict semantics.

Gateways enforce both total and per-principal connection limits. Rejected connections receive HTTP `503` and `Retry-After`. Zuno clients add configurable jitter to exponential reconnect delay; edge admission controls should also rate-limit by authenticated principal, not only by IP address.

## Regional routing and writer policy

- Terminate connections in the nearest healthy region when possible.
- Route live events only to gateways advertising subscribers for the event partition and topic. The reference server dynamically limits shared-bus consumption to partitions with local subscribers.
- Assign every partition exactly one authoritative writer or partition leader at a time. Gateways never elect leaders and never apply writes locally.
- Send mutations to the partition leader, which commits state and replay atomically before publishing the accepted event.
- During regional failover, fence the previous leader before promoting another. Replay from durable storage fills live-delivery gaps.
- Cross-region gateway scaling changes connection capacity only; compare-and-set and idempotency semantics remain at the authoritative writer.

Do not advertise a specific concurrent-connection capacity from these controls alone. Milestone 13 owns the repeatable distributed load test and SLO evidence.
