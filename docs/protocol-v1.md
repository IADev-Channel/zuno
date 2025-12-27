# Zuno Wire Protocol v1

This document defines the **language-agnostic protocol** used by Zuno for state synchronization across clients, tabs, and servers.

The goal of this protocol is to allow **multiple languages and frameworks** to interoperate without sharing implementation details.

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

All state mutations are represented as events.

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

| Field         | Required | Description                       |
| ------------- | -------- | --------------------------------- |
| `storeKey`    | ✅        | Unique store identifier           |
| `state`       | ✅        | JSON-serializable state           |
| `version`     | ✅        | Authoritative version             |
| `baseVersion` | ❌        | Version the mutation was based on |
| `origin`      | ❌        | Replica identifier                |
| `ts`          | ❌        | Timestamp (ms)                    |

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

* On connect, server sends a **snapshot** event
* Then streams future state events

#### Headers

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

#### SSE Message

```text
event: zuno
data: { "storeKey": "counter", "state": 6, "version": 4 }

```

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

* `200 OK` → event accepted and broadcast
* `409 Conflict` → version mismatch

```json
{ "current": { "state": 5, "version": 3 } }
```

---

## Conflict Rule

When receiving a mutation:

```text
if baseVersion !== currentVersion → reject (409)
```

Zuno provides **eventual consistency**, not strong consistency.

---

## Transport Notes

* BroadcastChannel works **only on same-origin tabs**
* SSE connections close when tab closes
* Snapshot + replay must be used for hydration

---

## Compatibility Rules

* State MUST be JSON-serializable
* No functions, symbols, or circular references
* Binary codecs (MessagePack / Protobuf) are future extensions

---

## Versioning

This document defines **Protocol v1**.
Breaking changes require a new major protocol version.
