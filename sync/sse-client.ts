import type { ZunoSSEOptions, ZunoStateEvent } from "./types";
import { createHttpTransport } from "./transport";

type SnapshotState = Record<string, unknown>;

/**
 * Starts a Server-Sent Events (SSE) connection to synchronize state from a server.
 * It can synchronize either a Zuno universe (collection of stores) or a single Zuno store.
 *
 * @param options - Configuration options for the SSE connection, including the URL,
 *                  and either a Zuno universe or a specific Zuno store to update.
 */
export const startSSE = (options: ZunoSSEOptions) => {
  if (!options?.url) throw new Error("startSSE: 'url' is required");
  if (!options.universe && !options.store)
    throw new Error("startSSE: provide either 'universe' or 'store'");

  const eventSource = new EventSource(options.url);
  const transport = createHttpTransport(options.syncUrl);

  /**
   * Applies an incoming state event to the target Zuno universe or store.
   * If a universe is provided, it updates the specific store identified by `storeKey`.
   * If a single store is provided, it updates that store directly.
   * @param eventState - The state event received from the SSE connection, containing `storeKey` and `state`.
   */
  const applyEventToTarget = (eventState: ZunoStateEvent) => {
    if (options.universe) {
      const store = options.universe.getStore(
        eventState.storeKey,
        () => eventState.state
      );
      store.set(eventState.state);
    } else if (options.store) {
      options.store.set(eventState.state);
    }
  };

  /**
   * Applies an incoming snapshot to the target Zuno universe or store.
   * If a universe is provided, it updates all stores in the snapshot.
   * If a single store is provided, it updates that store directly.
   * @param snapshot - The snapshot received from the SSE connection, containing a map of store keys to states.
   */
  const applySnapshotToTarget = (snapshot: unknown) => {
    if (options.universe) {
      const snap = (snapshot ?? {}) as SnapshotState;
      for (const [storeKey, state] of Object.entries(snap)) {
        const store = options.universe.getStore(storeKey, () => state);
        store.set(state);
      }
      options.getSnapshot?.(options.universe);
    } else if (options.store) {
      // For single-store mode: snapshot is the store's state
      options.store.set(snapshot);
      options.getSnapshot?.(options.store);
    }
  };

  /**
   * Handles incoming snapshot events from the SSE connection.
   * Parses the snapshot data and applies it to the target Zuno universe or store.
   * @param event - The MessageEvent containing the snapshot data.
   */
  const onSnapshot = (event: MessageEvent) => {
    try {
      const snapshotState = JSON.parse(event.data);
      applySnapshotToTarget(snapshotState);
    } catch {
      // don’t throw inside event handler; it can kill your stream flow silently
      console.error("Zuno SSE: failed to parse snapshot payload");
    }
  };

  /**
   * Handles incoming state events from the SSE connection.
   * Parses the state data and applies it to the target Zuno universe or store.
   * @param event - The MessageEvent containing the state data.
   */
  const onState = (event: MessageEvent) => {
    try {
      const eventState: ZunoStateEvent = JSON.parse(event.data);
      applyEventToTarget(eventState);
    } catch {
      console.error("Zuno SSE: failed to parse state payload");
    }
  };

  eventSource.addEventListener("snapshot", onSnapshot);
  eventSource.addEventListener("state", onState);

  /**
   * Unsubscribes from the SSE connection and removes the event listeners.
   */
  const unsubscribe = () => {
    eventSource.removeEventListener("snapshot", onSnapshot);
    eventSource.removeEventListener("state", onState);
    eventSource.close();
  };

  /**
   * Dispatches a state event to the server.
   * If optimistic = true, also applies the event locally immediately.
   * @param event - The state event to dispatch.
   */
  const dispatch = (event: ZunoStateEvent) => {
    if (options.optimistic) applyEventToTarget(event);
    transport.publish(event);
  };

  return { unsubscribe, dispatch };
};
