import { createUniverse } from "./universe";
import { startSSE } from "../sync/sse-client";
import { startBroadcastChannel } from "../sync/broadcast-channel";

import type { ZunoStateEvent } from "../sync/sync-types";
import { applyIncomingEvent } from "../sync/sync-core";

/** Store */
type ZunoStore<T> = {
  get(): T;
  set(next: T): void;
  subscribe(cb: (state: T) => void): () => void;
};

/** Universe */
type ZunoUniverse = {
  getStore<T>(storeKey: string, init: () => T): ZunoStore<T>;
  snapshot(): Record<string, unknown>;
};

export type CreateZunoOptions = {
  /** Universe */
  universe?: ZunoUniverse;

  /** Optional transports */
  channelName?: string;

  /** SSE */
  sseUrl?: string;

  /** Sync */
  syncUrl?: string;

  /** Behavior */
  optimistic?: boolean;

  /** Client ID */
  clientId?: string;
};

/**
 * Creates a Zuno instance, which provides a state management system with optional synchronization
 * capabilities via Server-Sent Events (SSE) and BroadcastChannel.
 *
 * @param opts - Configuration options for the Zuno instance.
 * @param opts.universe - An optional pre-existing ZunoUniverse instance. If not provided, a new one will be created.
 * @param opts.channelName - An optional name for the BroadcastChannel to enable local tab synchronization.
 * @param opts.sseUrl - The URL for the Server-Sent Events endpoint to receive state updates from a server.
 * @param opts.syncUrl - The URL for the synchronization endpoint to send state updates to a server. Required if `sseUrl` is provided.
 * @param opts.optimistic - A boolean indicating whether state updates should be applied optimistically before server confirmation. Defaults to `true`.
 * @param opts.clientId - A unique identifier for the client. If not provided, a random UUID will be generated.
 * @returns An object containing methods to interact with the Zuno instance, including `getStore`, `destroy`, and `broadcast`.
 */
export const createZuno = (opts: CreateZunoOptions = {}) => {

  /** Local state */
  const localState = new Map<string, unknown>();

  /** Local per-store versions (for BC / local ordering) */
  const versions = new Map<string, number>();

  /** Universe */
  const universe: ZunoUniverse = (opts.universe ?? (createUniverse() as any)) as any;

  /** Unique client ID */
  const clientId =
    opts.clientId ?? (globalThis.crypto?.randomUUID?.() ?? String(Math.random()));

  /** SSE ready */
  let sseReady = false;

  /** SSE Prefer server sync if provided */
  const sse =
    opts.sseUrl && opts.syncUrl
      ? startSSE({
        universe: universe as any,
        url: opts.sseUrl,
        syncUrl: opts.syncUrl,
        optimistic: opts.optimistic ?? true,
        clientId,
        onOpen: () => {
          sseReady = true;
        },
        onClose: () => {
          sseReady = false;
        },
      } as any)
      : null;

  /** Apply event to target */
  const apply = (event: ZunoStateEvent) =>
    applyIncomingEvent(universe as any, event, { clientId, localState, versions });


  /** Broadcast Channel for local tab sync */
  const bc = opts.channelName
    ? startBroadcastChannel({
      /** Channel name for BroadcastChannel */
      channelName: opts.channelName,

      /** Unique client ID */
      clientId,

      /** Apply event to target */
      onEvent: (ev) => {
        apply(ev);
      },

      /** Get snapshot of local state */
      getSnapshot: () => {

        /** Snapshot */
        const snap = universe.snapshot();

        /** Snapshot */
        const out: Record<string, { state: unknown; version: number }> = {};

        /** Iterate local state */
        for (const [storeKey, state] of Object.entries(snap)) {

          /** Add to snapshot */
          out[storeKey] = {
            state,
            version: versions.get(storeKey) ?? 0,
          };
        }
        return out;
      },

      /** Apply snapshot to target */
      onSnapshot: (snap) => {

        /** Iterate snapshot with store key and record */
        for (const [storeKey, rec] of Object.entries(snap)) {

          /** Record */
          const record = rec as any;

          /** Get the universe store state or the store state */
          const state = record?.state ?? record;

          /** Get the universe store version or the store version */
          const version = typeof record?.version === "number" ? record.version : 0;

          /** Set the latest version */
          // versions.set(storeKey, Math.max(versions.get(storeKey) ?? 0, version));

          /** Apply the event */
          apply({ storeKey, state, version });
        }

      },
    })
    : null;

  /** Immediately ask other tabs for snapshot (BC-first) */
  setTimeout(() => bc?.hello(), 0);

  /** Store factory
   * @param storeKey - The key of the store to get.
   * @param init - The initialization function for the store.
   * @returns The store.
  */
  const getStore = <T,>(storeKey: string, init: () => T) => {
    return universe.getStore<T>(storeKey, init);
  };

  /** Get store by store key
   * @param storeKey - The key of the store to get.
   * @param init - The initialization function for the store.
   * @returns The state of the store.
  */
  const get = <T,>(storeKey: string, init?: () => T): T => {
    return universe.getStore<T>(storeKey, init ?? (() => undefined as any)).get();
  };

  /** Dispatch event to universe
   * @param event - The event to dispatch.
   * @returns A promise that resolves to the result of the dispatch.
  */
  const dispatch = async (event: ZunoStateEvent) => {

    /** Check if SSE is enabled */
    if (sse && sseReady) {
      /** Payload with origin */
      const payload: ZunoStateEvent = { ...event, origin: clientId };

      /** Dispatch to SSE */
      return await sse.dispatch(payload);
    }

    /** Current version */
    const current = versions.get(event.storeKey) ?? 0;

    /** Next version */
    const nextVersion = current + 1;

    /** Apply event with next version */
    apply({ ...event, version: nextVersion });

    /** Set version */
    versions.set(event.storeKey, nextVersion);

    /** Check if BroadcastChannel is enabled */
    if (bc) {
      /** Publish event */
      bc.publish({ ...event, version: nextVersion, origin: clientId });
    }

    /** Return success */
    return { ok: true, status: 200, json: null };
  };

  /** Set store state
   * @param storeKey - The key of the store to set.
   * @param next - The new state to set.
   * @param init - The initialization function for the store.
   * @returns A promise that resolves to the result of the dispatch.
  */
  const set = async <T,>(
    storeKey: string,
    next: T | ((prev: T) => T),
    init?: () => T
  ) => {
    /** Get store */
    const store = universe.getStore<T>(storeKey, init ?? (() => undefined as any));

    /** Get previous state */
    const prev = store.get();

    /** Get next state */
    const state = typeof next === "function" ? (next as any)(prev) : next;

    /** Dispatch event */
    return dispatch({ storeKey, state });
  };

  /** Subscribe to store
   * @param storeKey - The key of the store to subscribe to.
   * @param init - The initialization function for the store.
   * @param cb - The callback function to be called when the store state changes.
   * @returns A function to unsubscribe from the store.
  */
  const subscribe = <T,>(
    storeKey: string,
    init: () => T,
    cb: (state: T) => void
  ) => {
    /** Get store */
    const store = universe.getStore<T>(storeKey, init);
    return store.subscribe(cb);
  };

  /** Stop cleanup */
  const stop = () => {
    sse?.unsubscribe?.();
    bc?.stop?.();
  };


  type BoundStore<T> = {
    key: string;
    get: () => T;
    set: (next: T | ((prev: T) => T)) => Promise<any>;
    subscribe: (cb: (state: T) => void) => () => void;
    raw: () => ZunoStore<T>; // access underlying store if needed
  };

  /**
   * Creates a bound store for a specific key.
   * @param storeKey The key of the store to create.
   * @param init The initialization function for the store.
   * @returns A BoundStore object representing the store.
   */
  const store = <T,>(storeKey: string, init: () => T): BoundStore<T> => {
    const rawStore = getStore<T>(storeKey, init);

    return {
      key: storeKey,
      raw: () => rawStore,
      get: () => rawStore.get(),
      subscribe: (cb) => rawStore.subscribe(cb),
      set: (next) => set<T>(storeKey, next as any, init),
    };
  };

  return {
    /** Universe */
    universe,
    /** Client ID */
    clientId,

    // ------------ DX ------------ \\
    /** Get store */
    getStore,
    /** Create store */
    store,
    /** Get state */
    get,
    /** Set state */
    set,
    /** Subscribe to store */
    subscribe,

    // ------------ Advanced ------------ \\
    /** Dispatch event */
    dispatch,
    /** Stop */
    stop,
  };
};
