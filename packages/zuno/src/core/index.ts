import { startSSE, startBroadcastChannel, applyIncomingEvent } from "../sync";
import type { ZunoStateEvent, TransportStatus, ConflictResolver } from "../sync";


// --- Types ---

/**
 * Authoritative snapshot of the entire universe.
 */
export type ZunoSnapshot = {
  state: Record<string, { state: unknown; version: number }>;
  lastEventId: number;
};

/**
 * A simple state container for a single keyed value.
 */
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: (state: T) => void): () => void;
}

/**
 * A Universe manages many stores.
 */
export interface Universe {
  getStore<T>(key: string, init: () => T): Store<T>;
  snapshot(): Record<string, unknown>;
  restore(data: Record<string, unknown>): void;
  delete(key: string): void;
  clear(): void;
  hydrateSnapshot(snapshot: ZunoSnapshot): void;
}

// --- Middleware Types ---

export type Dispatch = (event: ZunoStateEvent) => Promise<TransportStatus>;

export type MiddlewareAPI = {
  universe: Universe;
  clientId: string;
  versions: Map<string, number>;
};

export type Middleware = (
  api: MiddlewareAPI
) => (next: Dispatch) => Dispatch;

/**
 * Options for creating a Zuno instance.
 */
export type CreateZunoOptions = {
  /** Optional pre-existing universe. */
  universe?: Universe;
  /** BroadcastChannel name for local tab sync. */
  channelName?: string;
  /** SSE endpoint URL. */
  sseUrl?: string;
  /** Sync endpoint URL (required if sseUrl is provided). */
  syncUrl?: string;
  /** Apply updates locally before server confirmation (default: true). */
  optimistic?: boolean;
  /** Unique client identifier (default: random UUID). */
  clientId?: string;
  /** Middleware chain. */
  middleware?: Middleware[];
  /** Optional function to resolve 409 conflicts. */
  resolveConflict?: ConflictResolver;
};

/**
 * An extended interface for a Zuno store that includes methods for setting state
 * and a unique key identifier. This represents a store that has been "bound" or registered.
 */
export type BoundStore<T> = {
  key: string;
  get: () => T;
  set: (next: T | ((prev: T) => T)) => Promise<any>;
  subscribe: (cb: (state: T) => void) => () => void;
  raw: () => Store<T>;
};

// --- Store Implementation ---

/**
 * Creates a raw ZUNO state management store.
 */
export const createStore = <T>(initial: T): Store<T> => {
  let state = initial;
  const listeners = new Set<(state: T) => void>();

  return {
    get: () => state,
    set: (next) => {
      const value = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      listeners.forEach((l) => l(state));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

// --- Universe Implementation ---

/**
 * Creates a ZUNO Universe to manage multiple stores.
 */
export const createUniverse = (): Universe => {
  const stores = new Map<string, Store<any>>();

  const universe: Universe = {
    getStore<T>(key: string, init: () => T): Store<T> {
      if (!stores.has(key)) {
        stores.set(key, createStore(init()));
      }
      return stores.get(key)! as Store<T>;
    },
    snapshot(): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [key, store] of stores.entries()) {
        out[key] = store.get();
      }
      return out;
    },
    restore(data: Record<string, unknown>): void {
      for (const [key, value] of Object.entries(data)) {
        const existing = stores.get(key);
        if (existing) {
          existing.set(value as any);
        } else {
          stores.set(key, createStore(value as any));
        }
      }
    },
    delete(key: string): void {
      stores.delete(key);
    },
    clear(): void {
      stores.clear();
    },
    hydrateSnapshot(snapshot: ZunoSnapshot) {
      const plain: Record<string, unknown> = {};
      for (const [k, rec] of Object.entries(snapshot.state)) {
        plain[k] = rec.state;
      }
      this.restore(plain);
    },
  };

  return universe;
};

// --- Main Zuno Factory ---

/**
 * Creates a Zuno instance for distributed state synchronization.
 */
export const createZuno = (opts: CreateZunoOptions = {}) => {
  const localState = new Map<string, unknown>();
  const versions = new Map<string, number>();
  const universe = opts.universe ?? createUniverse();
  const clientId = opts.clientId ?? (globalThis.crypto?.randomUUID?.() ?? String(Math.random()));
  let sseReady = false;
  let lastEventId = 0;

  function hydrateSnapshot(snapshot: ZunoSnapshot) {
    const plain: Record<string, unknown> = {};
    for (const [k, rec] of Object.entries(snapshot.state)) {
      plain[k] = rec.state;
      versions.set(k, rec.version);
    }
    universe.restore(plain);
    lastEventId = snapshot.lastEventId;
  }

  const apply = (event: ZunoStateEvent) => {
    if (typeof event.eventId === "number") {
      lastEventId = Math.max(lastEventId, event.eventId);
    }
    applyIncomingEvent(universe, event, { clientId, localState, versions });
  };

  const sse = opts.sseUrl && opts.syncUrl
    ? startSSE({
      universe,
      url: opts.sseUrl,
      syncUrl: opts.syncUrl,
      optimistic: opts.optimistic ?? true,
      clientId,
      versions,
      getLastEventId: () => lastEventId,
      onOpen: () => { sseReady = true; },
      onClose: () => { sseReady = false; },
      onEvent: (e) => dispatch(e), // Route incoming SSE events through middleware
      resolveConflict: opts.resolveConflict,
    })
    : null;

  const bc = opts.channelName
    ? startBroadcastChannel({
      channelName: opts.channelName,
      clientId,
      onEvent: (e) => dispatch(e), // Route incoming BC events through middleware
      getSnapshot: () => {
        const snap = universe.snapshot();
        const out: Record<string, { state: unknown; version: number }> = {};
        for (const [storeKey, state] of Object.entries(snap)) {
          out[storeKey] = { state, version: versions.get(storeKey) ?? 0 };
        }
        return out;
      },
      onSnapshot: (snap) => {
        for (const [storeKey, rec] of Object.entries(snap)) {
          apply({ storeKey, state: rec.state, version: rec.version });
        }
      },
    })
    : null;

  setTimeout(() => bc?.hello(), 0);

  const coreDispatch = async (event: ZunoStateEvent): Promise<TransportStatus> => {
    // 1. Incoming Event (from Server or other Tab via BC)
    if (event.origin && event.origin !== clientId) {
      apply(event);
      // Incoming events don't need to be re-broadcasted to network or BC typically,
      // unless acting as a relay (not current design).
      return { ok: true, status: 200, json: null };
    }

    // 2. Outgoing Event (Local Action)
    if (sse) {
      const res = await sse.dispatch({
        ...event,
        origin: clientId,
        baseVersion: versions.get(event.storeKey) ?? 0,
      });

      if ((res.reason === "OFFLINE_QUEUED" || res.reason === "NETWORK_ERROR_QUEUED") && bc) {
        const v = versions.get(event.storeKey) ?? 0;
        bc.publish({ ...event, version: v, origin: clientId });
      }

      return res;
    }

    const nextVersion = (versions.get(event.storeKey) ?? 0) + 1;
    apply({ ...event, version: nextVersion });
    versions.set(event.storeKey, nextVersion);

    if (bc) {
      bc.publish({ ...event, version: nextVersion, origin: clientId });
    }

    return { ok: true, status: 200, json: null };
  };

  // --- Middleware Composition ---
  let dispatch: Dispatch = coreDispatch;

  if (opts.middleware && opts.middleware.length > 0) {
    const middlewareAPI: MiddlewareAPI = {
      universe,
      clientId,
      versions,
    };
    const chain = opts.middleware.map((middleware) => middleware(middlewareAPI));
    dispatch = chain.reduceRight((next, middleware) => middleware(next), coreDispatch);
  }

  const store = <T,>(storeKey: string, init: () => T): BoundStore<T> => {
    const rawStore = universe.getStore<T>(storeKey, init);
    return {
      key: storeKey,
      raw: () => rawStore,
      get: () => rawStore.get(),
      subscribe: (cb) => rawStore.subscribe(cb),
      set: (next) => {
        const prev = rawStore.get();
        const state = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        return dispatch({ storeKey, state });
      },
    };
  };

  return {
    universe,
    clientId,
    store,
    getStore: universe.getStore.bind(universe),
    get: <T,>(key: string, init?: () => T) => universe.getStore<T>(key, init ?? (() => undefined as any)).get(),
    set: async <T,>(key: string, next: T | ((prev: T) => T), init?: () => T) => {
      const s = universe.getStore<T>(key, init ?? (() => undefined as any));
      const state = typeof next === "function" ? (next as (prev: T) => T)(s.get()) : next;
      return dispatch({ storeKey: key, state });
    },
    subscribe: <T,>(key: string, init: () => T, cb: (state: T) => void) => universe.getStore<T>(key, init).subscribe(cb),
    dispatch,
    stop: () => {
      sse?.unsubscribe?.();
      bc?.stop?.();
    },
    hydrateSnapshot,
    getLastEventId: () => lastEventId,
    setLastEventId: (id: number) => { lastEventId = id; },
  };
};
