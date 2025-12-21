import { createUniverse } from "./universe";
import { startSSE } from "../sync/sse-client";
import { startBroadcastChannel } from "../sync/broadcast-channel";

import type { ZunoStateEvent } from "../sync/sync-types";
import { applyIncomingEvent } from "../sync/sync-core";

/** Local state */
const localState = new Map<string, unknown>();

/** Store */
type ZunoStore<T> = {
  get(): T;
  set(next: T): void;
  subscribe(cb: (state: T) => void): () => void;
};

/** Universe */
type ZunoUniverse = {
  getStore<T>(storeKey: string, init: () => T): ZunoStore<T>;
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

  /** Universe */
  const universe: ZunoUniverse = (opts.universe ?? (createUniverse() as any)) as any;

  /** Unique client ID */
  const clientId =
    opts.clientId ?? (globalThis.crypto?.randomUUID?.() ?? String(Math.random()));

  /** SSE Prefer server sync if provided */
  const sse =
    opts.sseUrl && opts.syncUrl
      ? startSSE({
        universe: universe as any,
        url: opts.sseUrl,
        syncUrl: opts.syncUrl,
        optimistic: opts.optimistic ?? true,
        clientId,
      } as any)
      : null;

  /** Apply event to target */
  const apply = (event: ZunoStateEvent) =>
    applyIncomingEvent(universe as any, event, { clientId, localState });

  /** BroadcastChannel */
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
      getSnapshot: () => Object.fromEntries(localState),

      /** Apply snapshot to target */
      onSnapshot: (snap) => {
        for (const [storeKey, state] of Object.entries(snap)) {
          apply({ storeKey, state });
        }
      },
    })
    : null;

  /** Post message hello to BroadcastChannel */
  setTimeout(() => bc?.hello(), 0);

  /** Store factory */
  const getStore = <T,>(storeKey: string, init: () => T) => {
    return universe.getStore<T>(storeKey, init);
  };

  /** Get store by store key */
  const get = <T,>(storeKey: string, init?: () => T): T => {
    return universe.getStore<T>(storeKey, init ?? (() => undefined as any)).get();
  };

  /** Dispatch event to universe */
  const dispatch = async (event: ZunoStateEvent) => {
    const payload: ZunoStateEvent = { ...event, origin: clientId };

    if (sse) return sse.dispatch(payload);
    if (bc) {
      apply(payload);
      bc.publish(payload);
    }
    return { ok: true, status: 200, json: null };
  };

  /** Set store state */
  const set = async <T,>(
    storeKey: string,
    next: T | ((prev: T) => T),
    init?: () => T
  ) => {
    const store = universe.getStore<T>(storeKey, init ?? (() => undefined as any));
    const prev = store.get();
    const state = typeof next === "function" ? (next as any)(prev) : next;

    return dispatch({ storeKey, state });
  };

  /** Subscribe to store */
  const subscribe = <T,>(
    storeKey: string,
    init: () => T,
    cb: (state: T) => void
  ) => {
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
    universe,
    clientId,

    // DX
    getStore,
    store,
    get,
    set,
    subscribe,

    // advanced
    dispatch,
    stop,
  };
};
