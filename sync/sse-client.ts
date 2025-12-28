import type { ZunoSSEOptions, ZunoStateEvent } from "./sync-types";
import { createTransport } from "./transport";
import { applyIncomingEvent } from "./apply-incoming-event";

type SnapshotRecord = { state: unknown; version: number };
type SnapshotState = Record<string, SnapshotRecord>;

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

  const clientId =
    options.clientId ?? (crypto?.randomUUID?.() ?? String(Math.random()));


  // const eventSource = new EventSource(options.url);
  const lastEventId = options.getLastEventId?.() ?? 0;
  const url =
    lastEventId > 0
      ? `${options.url}?lastEventId=${encodeURIComponent(String(lastEventId))}`
      : options.url;
  const eventSource = new EventSource(url);

  const transport = createTransport(options.syncUrl);

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
   * Tracks the version of each store to handle conflicts.
   */
  const versions = options.versions;

  /**
   * Applies an incoming snapshot to the target Zuno universe or store.
   * If a universe is provided, it updates all stores in the snapshot.
   * If a single store is provided, it updates that store directly.
   * @param snapshot - The snapshot received from the SSE connection, containing a map of store keys to states.
   */
  const applySnapshotToTarget = (snapshot: unknown) => {
    if (options.universe) {
      const snap = (snapshot ?? {}) as SnapshotState;

      for (const [storeKey, rec] of Object.entries(snap)) {
        versions.set(storeKey, rec?.version ?? 0);

        const store = options.universe.getStore(storeKey, () => rec.state);
        store.set(rec.state);
      }

      options.getSnapshot?.(options.universe);
    } else if (options.store) {
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

      /** 
       * Apply incoming event to universe or store 
       */
      if (options.universe) {
        applyIncomingEvent(options.universe, eventState, {
          clientId,
          versions,
        });
      }
      /**
       * Apply incoming event to store
       */
      else if (options.store) {
        // Minimal support for single-store subscriptions.
        if (typeof eventState.version === "number") {
          const currentVersion = versions.get(eventState.storeKey) ?? 0;
          if (eventState.version <= currentVersion) return;
          versions.set(eventState.storeKey, eventState.version);
        }
        options.store.set(eventState.state);
      }
    } catch {
      console.error("Zuno SSE: failed to parse state payload");
    }
  };

  eventSource.addEventListener("snapshot", onSnapshot);
  eventSource.addEventListener("state", onState);

  eventSource.onopen = () => {
    options.onOpen?.();
  };

  eventSource.onerror = () => {
    options.onClose?.();
  };

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
  const dispatch = async (event: ZunoStateEvent) => {
    const baseVersion = versions.get(event.storeKey) ?? 0;

    /** Payload to send to server with event metadata, version and origin */
    const payload: ZunoStateEvent = {
      ...event,
      origin: clientId
    };

    /**
     * Optimistic logic applied locally
     */
    if (options.optimistic) {
      applyEventToTarget(payload);
      versions.set(event.storeKey, baseVersion + 1);
    }

    /**
     * AUTHORITATIVE: send to server
     */
    const result = await transport.publish(payload);

    /**
     * If server rejects, reconcile (optional but good)
     */
    if (!result.ok && result.status === 409 && result.json?.current && options.universe) {
      const { state, version } = result.json.current;
      versions.set(event.storeKey, version);
      options.universe.getStore(event.storeKey, () => state).set(state);
    }

    return result;
  };

  return { unsubscribe, dispatch };
};
