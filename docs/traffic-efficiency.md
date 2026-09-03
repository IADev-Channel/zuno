# Traffic and Connection Efficiency

Milestone 12 reduces request count, payload size, and browser connection count
without changing Zuno's server-authoritative compare-and-set semantics.

## Client configuration

```ts
const zuno = createZuno({
  sseUrl: "/zuno/events",
  syncUrl: "/zuno/sync",
  channelName: "my-app:user-123",
  shareConnection: true,
  batchSync: { waitMs: 5, maxSize: 50 },
  optimizePayload: true,
  compressionThresholdBytes: 16 * 1024,
  onMetric: (metric) => metrics.record(metric),
});
```

`batchSync: true` batches mutations queued in the same microtask, up to 50
distinct store keys. The object form adds a bounded wait. Repeated writes to one
store are coalesced while preserving the first base version and latest state.
The server applies entries in order and stops at the first failure. A batch is
not an atomic database transaction: entries accepted before a conflict remain
committed.

Payload optimization is enabled by default. When both current and next values
are objects, Zuno computes `set` and `unset` fields and sends the delta only when
its serialized form is smaller. The authority materializes the full state before
validation, persistence, and fan-out. Set `optimizePayload: false` when a custom
server requires full client snapshots.

Mutation JSON is gzip-compressed when its encoded size reaches
`compressionThresholdBytes` and the runtime supports `CompressionStream`. The
raw Node handler accepts gzip request bodies and enforces limits on both the
compressed and decompressed body.

## Sharing browser connections

`shareConnection: true` requires `channelName`. In browsers that support Web
Locks, one same-origin tab owns the SSE connection and republishes authoritative
events through BroadcastChannel. When its lock is released another tab may take
ownership. Unsupported browsers safely retain one SSE connection per tab.

Cross-tab snapshots contain only the last server-confirmed state and version,
not a tab's newer optimistic view. Successful HTTP responses advance that
authoritative baseline, and conflict corrections are sent to peer tabs once
without being rebroadcast in a loop. This prevents an older open tab from
overriding a fresh server snapshot and causing the next mutation to snap back.

Do not reuse a channel name across users or tenants. Include the application and
authenticated-principal namespace in both the channel and optional lock key.

## Optional WebSocket downstream

Set `webSocketUrl` to use WebSocket for snapshots and authoritative events:

```ts
const zuno = createZuno({
  webSocketUrl: "wss://api.example.com/zuno",
  syncUrl: "https://api.example.com/zuno/sync",
});
```

Writes continue over the same HTTP endpoint, including batching, compression,
conflict responses, and persistence. On the server, pass an authenticated,
upgraded socket to `createWebSocketConnection` from `@iadev93/zuno/server`; the
helper registers it with the connection gateway and sends an initial snapshot.
Socket authentication and the protocol upgrade remain the host framework's
responsibility.

## Telemetry

Client transports emit `zuno.transport.bytes_sent` and
`zuno.transport.bytes_received` with unit `bytes`. Gateways can emit connection,
slow-consumer, byte, and fan-out metrics through their `onMetric` option. Byte
metrics measure the application payload visible to Zuno; they do not include
TLS, HTTP, or WebSocket framing overhead.
