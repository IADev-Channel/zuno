# Protocol Truth Table

This document defines the expected behavior of Zuno replicas when encountering version conflicts during synchronization, specifically after periods of offline usage.

## The Reconnection Scenario

1.  **Stable State**: Client and Server are at `v1`.
2.  **Client Offline**: Network connection is lost.
3.  **Local Mutation**: User changes state on Client (`v1` → `v2-local`).
4.  **Remote Mutation**: Another client changes state on Server (`v1` → `v2-server`).
5.  **Reconnect**: Client regains connection and attempts to sync `v2-local` with `baseVersion: 1`.
6.  **Conflict**: Server detects `baseVersion (1) !== currentVersion (2-server)` and returns `409 Conflict`.

## Conflict Matrix

| Strategy | Client Action on 409 | Final State (Client) | Final State (Server) | Reliability |
| :--- | :--- | :--- | :--- | :--- |
| **Prefer Server** (Default) | Discard local change, apply `v2-server`. | `v2-server` | `v2-server` | High (Convergent) |
| **Prefer Local** | Re-apply local delta on top of `v2-server`. | `v2-merged` | `v2-merged` (after retry) | Medium (Risk of loops) |
| **Manual Resolver** | Invoke user callback to merge `local` + `server`. | User Defined | User Defined | High (Context Aware) |

## Event Lifecycle Truth Table

| State | Event | Result | Next Step |
| :--- | :--- | :--- | :--- |
| Connected | `dispatch(state)` | `200 OK` | Broadcast to all replicas. |
| Offline | `dispatch(state)` | `QUEUED` | Apply optimistically locally. |
| Reconnecting | `flush_queue()` | `POST /sync` | Start resolution loop. |
| Conflict | `409 Response` | `RESOLVE` | Execute `resolveConflict` logic. |

---

## Detailed Outcomes

### 1. Prefer Server
The simplest strategy. The client assumes the server is the absolute source of truth. Any local changes made while offline that conflict with server updates are overwritten.
- **Pros**: Guaranteed convergence, no logic complexity.
- **Cons**: Potential data loss for the offline user.

### 2. Prefer Local
The client attempts to "force" its state. Technically, this means the client takes the new server state, applies its local mutation again, and attempts a new `POST` with the new `baseVersion`.
- **Pros**: User never loses their local work.
- **Cons**: Can lead to "last-writer-wins" overwrites of other users' data.

### 3. Manual Resolver
The developer provides a `resolveConflict(local, server, key)` function.
- **Example**: For a counter, `Math.max(local, server)`.
- **Example**: For a list, merging unique items.
