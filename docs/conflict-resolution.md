# Conflict Resolution Strategies

Zuno provides multiple ways to handle state divergence. This document explains how to implement each outcome mentioned in the [Protocol Truth Table](./protocol-truth-table.md).

## 1. Outcome: Prefer Server (Default)

This is the default Zuno behavior. If a conflict occurs, the client simply accepts the server's state.

```typescript
const zuno = createZuno({
  // By default, if resolveConflict is not provided, 
  // Zuno will roll back to the server state on 409.
});
```

## 2. Outcome: Prefer Local

To implement a "Prefer Local" strategy, the resolver always returns the local state. Zuno will then attempt to sync this value again using the updated server version as the new base.

```typescript
const zuno = createZuno({
  resolveConflict: (local, server) => {
    console.log("Conflict! Forcing local state.");
    return local; 
  }
});
```

> [!WARNING]
> Use this carefully. If multiple clients "Prefer Local", they may enter a race condition where they constantly overwrite each other.

## 3. Outcome: Manual Resolver (Merge)

This is the most robust approach. You examine both states and derive a combined version.

### Numeric Merge
```typescript
resolveConflict: (local, server) => {
  // Highest number wins
  return Math.max(local as number, server as number);
}
```

### Object/Deep Merge
```typescript
resolveConflict: (local, server) => {
  return {
    ...server,
    ...local,
    lastEditedBy: 'me'
  };
}
```

## Implementation Flow

When a `409 Conflict` is received:
1.  Zuno pauses the sync queue for that store.
2.  The `resolveConflict` hook is called with `(localState, serverState, storeKey)`.
3.  The return value of this hook becomes the **new local state**.
4.  Zuno automatically triggers a re-sync of this new state with the correct `baseVersion` (the version returned by the server in the 409 payload).

---

## Technical Notes

-   **Optimistic UI**: During the conflict resolution, the UI might flicker if the resolution result differs significantly from the optimistic local state.
-   **Server-Side Resolution**: While Zuno primarily handles resolution on the client (to keep the server simple/stateless), a server can also enforce its own rules by rejecting certain `POST` requests even if versions match (e.g., validation logic).
