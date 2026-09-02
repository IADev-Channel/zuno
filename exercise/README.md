# Zuno Exercises

## One-place server configuration

Edit [`config.ts`](./config.ts) to change exercise ports or select which backend
the React, Angular, and Basic HTML clients use:

```ts
export const ACTIVE_EXERCISE_SERVER = "express";
```

Set it to `"express"`, `"elysia"`, or `"http"`. Every browser client derives
its SSE and sync URLs from this selection, so client files do not need edits.
The default is the SQLite-backed Express server.

## Tutorials and recommended learning path

Each exercise contains a standalone guide explaining how it is built, which
Zuno features it uses, how state moves through it, and how to extend it:

1. [Basic HTML](./basic-html/README.md) — learn core stores, subscriptions,
   optimistic updates, batching, SSE, BroadcastChannel, and IndexedDB queues.
2. [React](./react/README.md) — add React hooks, selectors, middleware, and
   conflict resolution.
3. [Angular](./angular/README.md) — use dependency injection, Signals, and RxJS.
4. [Raw Node HTTP](./http-server/README.md) — understand low-level SSE, sync,
   snapshot, validation, and routing helpers.
5. [Express](./express/README.md) — mount adapter handlers and durable authority
   in an Express application.
6. [Elysia](./elysia/README.md) — run the shared demo server, persistence, replay,
   snapshot fallback, and server-originated events.

For the fastest end-to-end introduction, start with Basic HTML and Elysia, then
open React or Angular to observe the same stores synchronize across frameworks.

## Run the demos

```bash
pnpm start
```

Open the React, Angular, and Basic HTML URLs printed by Vite. Updating the counter or todo list in one client should update the others.
Each browser client shows its SSE connection, durable queue depth, reconnect
attempt, and detected-conflict count above the demo controls.

## Durable server persistence exercises

The server exercises demonstrate both persistence adapters:

- Elysia stores the shared browser-demo universe in `exercise/elysia/.data/zuno.json`.
- Express stores its independent SQLite universe in `exercise/express/.data/zuno.sqlite`.
- Raw Node HTTP stores its independent SQLite universe in `exercise/http-server/.data/zuno.sqlite`.

Express and Raw Node import `createSQLiteZunoServerPersistence()` from
`@iadev93/zuno/server/sqlite`. Elysia runs on Bun, which does not currently
provide `node:sqlite`, so it intentionally demonstrates the durable JSON file
adapter instead.

Change state through a browser or server endpoint, stop the server, and start it
again. The snapshot and retained replay history should survive. The `.data`
directories are ignored by Git. To reset an exercise, stop its server and delete
that exercise's `.data` directory before restarting it.

Each browser exercise uses an IndexedDB-backed offline queue. Because the Vite
clients run on different origins, each origin has its own `zuno-exercises`
database and a framework-specific queue key.

## Durable offline queue exercise

1. Open any browser client and switch the Network profile to **Offline**.
2. Change the counter or todo list. The optimistic change is written to IndexedDB.
3. Reload the page while it is still offline.
4. Restore the Network profile to **Online**.
5. The new client instance loads the queued mutation, sends it to the shared
   selected server, and clears the durable queue after acknowledgement.

Multiple offline changes to the same store are coalesced when the queue flushes.
Only that store's latest state is sent; changes for different stores are retained
separately. You can confirm this by changing the counter several times offline
and observing a single final counter mutation after reconnecting.

### Cross-framework realtime recovery check

This reproduces the stale-offline-replica case covered by Milestone 11:

1. Open Angular, switch it offline, and add several todos.
2. Restore Angular online and wait for its queue to settle.
3. In React, add another todo while Angular remains open.
4. Angular must display the React todo immediately without a refresh.

Server-approved SSE events are authoritative even when an offline replica's
optimistic version is numerically higher. The original event origin is used
only to suppress delivery back to the client that proposed it.

To inspect the queue, open the browser's Application panel, expand IndexedDB,
and inspect the `offline-queues` store inside `zuno-exercises`.

## Missed-event replay exercise

This exercise verifies that an SSE client receives events it missed during a short disconnection.

The replay-generator route belongs to Elysia. First set
`ACTIVE_EXERCISE_SERVER` to `"elysia"` in `exercise/config.ts`, then restart the
browser client and Elysia server.

1. Open one of the browser clients and note its counter value.
2. In browser developer tools, switch the Network profile to **Offline**.
3. Generate five authoritative server events from another terminal:

   ```bash
   curl -X POST http://localhost:3002/zuno/replay/5
   ```

4. Restore the browser Network profile to **Online**.
5. The SSE client reconnects with its last event ID, receives the five retained events, and converges on the latest counter value.

The endpoint accepts between 1 and 100 events and returns the generated event-ID range.

It increments by default. Pass `decrement` to generate decreasing counter events:

```bash
curl -X POST http://localhost:3002/zuno/replay/5/decrement
```

Both forms exercise replay; the operation only controls the counter direction.

## Replay-gap snapshot exercise

The Elysia demo retains 1,000 events by default. To verify snapshot fallback:

1. Stop or disconnect a browser client long enough for its last event ID to become older than the retained log.
2. For quicker manual testing, temporarily create the Elysia server with a smaller log:

   ```ts
   const server = createZunoServerState({ maxEvents: 3 });
   const zuno = createZunoElysia({ server });
   ```

3. Generate five events with `POST /zuno/replay/5`.
4. Reconnect the stale client.
5. The server detects that replay is incomplete and sends a full authoritative snapshot instead.

## Inspect current server state

```bash
curl http://localhost:3002/zuno/snapshot
```

The response includes the current universe and `lastEventId`.
