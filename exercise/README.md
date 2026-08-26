# Zuno Exercises

The React, Angular, and Basic HTML clients share the Elysia server at `http://localhost:3002`. The Express server on port 3003 is an independent adapter exercise with its own in-memory universe.

## Run the demos

```bash
pnpm start
```

Open the React, Angular, and Basic HTML URLs printed by Vite. Updating the counter or todo list in one client should update the others.

## Missed-event replay exercise

This exercise verifies that an SSE client receives events it missed during a short disconnection.

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
