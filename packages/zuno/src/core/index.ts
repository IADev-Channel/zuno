import type {
	ConflictResolver,
	TransportStatus,
	ZunoStateEvent,
} from "../sync";
import { applyIncomingEvent, startBroadcastChannel, startSSE } from "../sync";

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
	apply(intent: unknown): void;
	subscribe(listener: (state: T) => void): () => void;
	equals(val1: unknown, val2: unknown): boolean;
}

/**
 * A Universe manages many stores.
 */
export interface Universe {
	getStore<T>(
		key: string,
		init: () => T,
		reducer?: (prev: T, intent: unknown) => T,
		equals?: (v1: unknown, v2: unknown) => boolean,
	): Store<T>;
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

export type Middleware = (api: MiddlewareAPI) => (next: Dispatch) => Dispatch;

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
	/** Batch multiple updates in the same microtask (default: false). */
	batchSync?: boolean;
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
	set: (next: T | ((prev: T) => T)) => Promise<unknown>;
	subscribe: (cb: (state: T) => void) => () => void;
	equals: (v1: unknown, v2: unknown) => boolean;
	raw: () => Store<T>;
};

// --- Store Implementation ---

/**
 * Creates a raw ZUNO state management store.
 */
export const createStore = <T>(
	initial: T,
	reducer?: (prev: T, intent: unknown) => T,
	equals: (v1: unknown, v2: unknown) => boolean = Object.is,
): Store<T> => {
	let state = initial;
	const listeners = new Set<(state: T) => void>();

	const notify = () => {
		listeners.forEach((l) => {
			l(state);
		});
	};

	return {
		get: () => state,
		equals,
		set: (next) => {
			const value =
				typeof next === "function" ? (next as (prev: T) => T)(state) : next;
			if (equals(value, state)) return;
			state = value;
			notify();
		},
		apply: (intent) => {
			const i = intent as { type: string; payload?: any };
			if (i.type === "SET") {
				const value = i.payload;
				if (equals(value, state)) return;
				state = value;
				notify();
				return;
			}
			if (!reducer) {
				console.warn(
					`[Zuno] apply() called for intent "${i.type}" on a store without a reducer. Intent ignored.`,
				);
				return;
			}
			const nextState = reducer(state, i);
			if (equals(nextState, state)) return;
			state = nextState;
			notify();
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
	// biome-ignore lint/suspicious/noExplicitAny: internal registry of heterogeneous stores
	const stores = new Map<string, Store<any>>();
	let cachedSnapshot: Record<string, any> | null = null;

	const universe: Universe = {
		getStore<T>(
			key: string,
			init: () => T,
			reducer?: (prev: T, intent: unknown) => T,
			equals?: (v1: unknown, v2: unknown) => boolean,
		): Store<T> {
			let s = stores.get(key);
			if (!s) {
				s = createStore(init(), reducer, equals);
				stores.set(key, s);
				// Invalidate cache when new store is added
				cachedSnapshot = null;
				// Subscribing to invalidate cache on changes
				s.subscribe(() => {
					cachedSnapshot = null;
				});
			}
			return s as Store<T>;
		},
		snapshot(): Record<string, unknown> {
			if (cachedSnapshot) return cachedSnapshot;

			const out: Record<string, unknown> = {};
			for (const [key, store] of stores.entries()) {
				out[key] = store.get();
			}
			cachedSnapshot = out;
			return out;
		},
		restore(data: Record<string, unknown>): void {
			for (const [key, value] of Object.entries(data)) {
				const existing = stores.get(key);
				if (existing) {
					// biome-ignore lint/suspicious/noExplicitAny: external data needs to be cast to store type
					existing.set(value as any);
				} else {
					// biome-ignore lint/suspicious/noExplicitAny: external data needs to be cast to store type
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
	const clientId =
		opts.clientId ?? globalThis.crypto?.randomUUID?.() ?? String(Math.random());
	let _sseReady = false;
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

	const sse =
		opts.sseUrl && opts.syncUrl
			? startSSE({
					universe,
					url: opts.sseUrl,
					syncUrl: opts.syncUrl,
					optimistic: opts.optimistic ?? true,
					clientId,
					versions,
					getLastEventId: () => lastEventId,
					onOpen: () => {
						_sseReady = true;
					},
					onClose: () => {
						_sseReady = false;
					},
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

	setTimeout(() => bc?.hello(), 100);

	// --- Sync Batching ---
	const pendingSyncs = new Map<string, ZunoStateEvent>();
	let batchPromise: Promise<void> | null = null;

	const flushBatch = async () => {
		const syncs = Array.from(pendingSyncs.values());
		pendingSyncs.clear();
		batchPromise = null;

		for (const event of syncs) {
			if (sse) {
				sse.dispatch(event).catch((err) => {
					console.error("[Zuno] Batch sync failed", err);
				});
			}
		}
	};

	const coreDispatch = async (
		event: ZunoStateEvent,
	): Promise<TransportStatus> => {
		// 1. Incoming/Reflected Event Logic (events WITH origin)
		if (event.origin) {
			// Always call apply to let applyIncomingEvent handle version checks and application
			apply(event);

			// If it's from another client, we are done
			if (event.origin !== clientId) {
				return { ok: true, status: 200, json: null };
			}
			// If it's a reflected local event, we still need to broadcast it (fall through)
		}

		// 2. Outgoing Event Logic (events WITHOUT origin)
		if (!event.origin) {
			event.origin = clientId;

			// Resolve state if needed (e.g. from mutate)
			const store = universe.getStore(event.storeKey, () => undefined);

			if (event.state === undefined && event.intent) {
				// We need the state to send to server.
				// If optimistic, we apply it. If not, we only compute if it's a simple SET.
				if (opts.optimistic !== false) {
					store.apply(event.intent);
					event.state = store.get();
				} else {
					const i = event.intent as { type: string; payload?: any };
					if (i.type === "SET") {
						event.state = i.payload;
					}
					// For other intents with optimistic: false, we might send undefined state
					// and rely on the server to compute it authoritativeley.
				}
			} else if (event.state !== undefined) {
				if (opts.optimistic !== false) {
					// biome-ignore lint/suspicious/noExplicitAny: generic dispatch layer
					store.set(event.state as any);
				}
			}

			// Local bookkeeping and versioning
			if (opts.optimistic !== false) {
				const current = versions.get(event.storeKey) ?? 0;
				const nextVersion = current + 1;
				versions.set(event.storeKey, nextVersion);
				event.version = nextVersion;
			}

			// BROADCAST IMMEDIATELY to local tabs via BC
			// This ensures instant sync across tabs even if SSE is slow or down.
			if (bc) {
				bc.publish(event);
			}
		}

		// 3. Remote Sync (SSE/HTTP) with Optional Batching
		if (sse) {
			if (opts.batchSync) {
				// Coalesce outgoing syncs for the same storeKey within the same microtask
				pendingSyncs.set(event.storeKey, event);

				if (!batchPromise) {
					batchPromise = Promise.resolve().then(flushBatch);
				}

				// Note: Batched dispatch currently returns a "fake" OK immediately
				// to avoid blocking the UI. Error handling is handled via console.error in flushBatch.
				// Real conflict resolution still happens via SSE's internal queue/retry.
				return { ok: true, status: 202, json: { batched: true } };
			}

			return await sse.dispatch(event);
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
		const chain = opts.middleware.map((middleware) =>
			middleware(middlewareAPI),
		);
		dispatch = chain.reduceRight(
			(next, middleware) => middleware(next),
			coreDispatch,
		);
	}

	const store = <T>(
		storeKey: string,
		init: () => T,
		reducer?: (prev: T, intent: unknown) => T,
		equals?: (v1: unknown, v2: unknown) => boolean,
	): BoundStore<T> => {
		const rawStore = universe.getStore<T>(storeKey, init, reducer, equals);
		return {
			key: storeKey,
			raw: () => rawStore,
			get: () => rawStore.get(),
			subscribe: (cb) => rawStore.subscribe(cb),
			equals: (v1, v2) => rawStore.equals(v1, v2),
			set: (next) => {
				const prev = rawStore.get();
				const state =
					typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
				return dispatch({
					storeKey,
					state,
					intent: { type: "SET", payload: state },
				});
			},
		};
	};

	return {
		universe,
		clientId,
		store,
		getStore: universe.getStore.bind(universe),
		get: <T>(key: string, init?: () => T) =>
			universe
				.getStore<T>(
					key,
					// biome-ignore lint/suspicious/noExplicitAny: default init for convenience
					init ?? (() => undefined as any),
				)
				.get(),
		set: async <T>(key: string, next: T | ((prev: T) => T), init?: () => T) => {
			const s = universe.getStore<T>(
				key,
				// biome-ignore lint/suspicious/noExplicitAny: default init for convenience
				init ?? (() => undefined as any),
			);
			const state =
				typeof next === "function" ? (next as (prev: T) => T)(s.get()) : next;

			// Don't set origin or version here, let coreDispatch handle it
			return dispatch({
				storeKey: key,
				state,
				intent: { type: "SET", payload: state },
			});
		},
		mutate: async (
			key: string,
			intent: { type: string; payload?: unknown },
		) => {
			return dispatch({
				storeKey: key,
				// coreDispatch will calculate state from intent
				state: undefined as any,
				intent,
			});
		},
		subscribe: <T>(key: string, init: () => T, cb: (state: T) => void) =>
			universe.getStore<T>(key, init).subscribe(cb),
		dispatch,
		stop: () => {
			sse?.unsubscribe?.();
			bc?.stop?.();
		},
		hydrateSnapshot,
		getLastEventId: () => lastEventId,
		setLastEventId: (id: number) => {
			lastEventId = id;
		},
	};
};
