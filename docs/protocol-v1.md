# Zuno Wire Protocol v1

This document defines the **language-agnostic protocol** used by Zuno for state synchronization across clients, tabs, and servers.

The goal of this protocol is to allow **multiple languages and frameworks** to interoperate without sharing implementation details.

> Think of the protocol as the contract: any runtime that can emit events and understand versions can join the mesh.

---

## Design Goals

* Deterministic state replication
* Transport-agnostic (HTTP, SSE, BroadcastChannel, etc.)
* Simple conflict detection (no CRDTs)
* JSON-first (binary codecs can come later)
* Easy to implement in any backend language

---

## Core Concepts

### Replica

A replica is any runtime participating in state sync:

* browser tab
* server process
* background worker

Each replica maintains local state and exchanges **events**.

---

## Event Format

All state mutations are represented as events. An event is the authoritative description of “what happened” to a store.

```json
{
  "storeKey": "counter",
  "state": 5,
  "version": 3,
  "baseVersion": 2,
  "origin": "client-abc",
  "ts": 1730000000000
}
```

### Fields

| Field         | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `storeKey`    | ✅        | Unique store identifier                                        |
| `state`       | ✅        | JSON-serializable state                                        |
| `version`     | ✅        | Authoritative version after applying this event                |
| `baseVersion` | ❌        | Version the mutation was based on (used for conflict checks)   |
| `origin`      | ❌        | Replica identifier (helps with loopback suppression/logging)   |
| `ts`          | ❌        | Timestamp (ms) when emitted (useful for debugging/metrics)     |

---

## Snapshot Format

Snapshots are sent to late-joining replicas.

```json
{
  "counter": { "state": 5, "version": 3 },
  "user": { "state": { "id": 1 }, "version": 7 }
}
```

### Snapshot Record

```ts
{
  state: unknown;
  version: number;
}
```

---

## Server Endpoints

### GET `/zuno/sse`

Establishes a **Server-Sent Events** stream.

#### Behavior

* On connect, server sends a **snapshot** event containing all known stores for that namespace/user.
* Then streams future state events.

#### Headers

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

#### SSE Message

```text
id: 5
event: state
data: { "storeKey": "counter", "state": 6, "version": 4, "eventId": 5 }

```

### Last Event ID & Reconnection

To handle network interruptions, Zuno supports the standard SSE `Last-Event-ID` mechanism.

1. **Client**: Sends `Last-Event-ID` header or `lastEventId` query parameter on reconnect.
2. **Server**: Checks for missed events after that ID and replays them before resuming the live stream.
3. **Fallback**: If no ID is provided, the server sends a full **snapshot** to re-synchronize the client.

---

### POST `/zuno/sync`

Clients send mutations to the server.

#### Request Body

```json
{
  "storeKey": "counter",
  "state": 6,
  "baseVersion": 3
}
```

#### Responses

* `200 OK` → event accepted and broadcast to subscribers (including the sender unless filtered by `origin`)
* `409 Conflict` → version mismatch (client should refetch current state and retry)

```json
{ "current": { "state": 5, "version": 3 } }
```

--- 

## Client Flow Overview

1. **Connect** via SSE to receive a snapshot and ongoing events.
2. **Hydrate** local stores from the snapshot.
3. **Propose** a change with `POST /zuno/sync`, including the `baseVersion` you observed.
4. **Apply** the event when the server responds `200 OK`; if `409`, refresh from the returned `current` payload and retry.
5. **Broadcast** (optional) across same-origin tabs with BroadcastChannel to reduce server load.

This loop keeps replicas converging without assuming a specific UI framework.

---

## Conflict Rule

When receiving a mutation:

```text
if baseVersion !== currentVersion → reject (409)
```

Zuno provides **eventual consistency**, not strong consistency.

---

## Transport Notes

* BroadcastChannel works **only on same-origin tabs**.
* SSE connections close when tab closes; reconnect should rehydrate from a fresh snapshot.
* Snapshot + replay must be used for hydration so that late subscribers catch up.
* WebSocket support can mirror the same message shapes; SSE is the minimal baseline.

---

## Compatibility Rules

* State MUST be JSON-serializable
* No functions, symbols, or circular references
* Binary codecs (MessagePack / Protobuf) are future extensions

---

## Versioning

This document defines **Protocol v1**.
Breaking changes require a new major protocol version.
