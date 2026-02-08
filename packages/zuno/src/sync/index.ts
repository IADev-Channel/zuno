import type { Universe } from "../core";

// --- Types ---

export type ConflictResolver<T = unknown> = (
	localState: T,
	serverState: T,
	storeKey: string,
) => T;

/**
 * Authoritative state event.
 */
export type ZunoStateEvent = {
	storeKey: string;
	state: unknown; // Was 'any', now strictly 'unknown'
	intent?: { type: string; payload?: unknown };
	version?: number;
	baseVersion?: number;
	origin?: string;
	ts?: number;
	eventId?: number;
};

/**
 * Generic transport status.
 */
export type TransportStatus = {
	ok: boolean;
	status: number;
	// biome-ignore lint/suspicious/noExplicitAny: generic JSON response
	json: any;
	reason?: string;
};

/**
 * Client transport interface.
 */
export interface ZunoTransport {
	dispatch(event: ZunoStateEvent): Promise<TransportStatus>;
	unsubscribe?(): void;
}

/**
 * Apply incoming event to the universe and local bookkeeping.
 */
export function applyIncomingEvent(
	universe: Universe,
	event: ZunoStateEvent,
	context: {
		clientId: string;
		localState: Map<string, unknown>;
		versions: Map<string, number>;
	},
) {
	const { clientId, versions } = context;

	// 1. Determine if this event is Authoritative (from Server) or Optimistic (from Peer/Local)
	const isAuthoritative =
		event.origin === "server" || event.origin === "conflict-resolution";
	const current = versions.get(event.storeKey) ?? 0;

	// 2. Version check
	if (typeof event.version === "number") {
		// If it's not authoritative, we strictly enforce incrementing versions
		if (!isAuthoritative && event.version <= current) {
			return;
		}

		// Update version tracker
		versions.set(event.storeKey, event.version);
	} else if (event.origin === clientId) {
		// Suppress versionless loopback
		return;
	}

	// 3. Apply to universe
	const store = universe.getStore(event.storeKey, () => event.state);

	// If we have an intent, try to apply it first for side effects (but only if it's forward progress or authoritative)
	if (event.intent) {
		// If it's a version match/stale authoritative event, we might want to SKIP the intent
		// to avoid double-application (since we likely already did it optimistically).
		// However, snapping state (below) is always safe.
		if (
			typeof event.version === "number" &&
			event.version <= current &&
			isAuthoritative
		) {
			// Skip intent, but snap state anyway below.
		} else {
			store.apply(event.intent);
		}
	}

	// 4. Authoritative State Snap
	// ALWAYS apply the state if provided and it's authoritative or has a higher version.
	if (event.state !== undefined) {
		if (
			isAuthoritative ||
			(typeof event.version === "number" && event.version > current)
		) {
			store.set(event.state);
		}
	}
}

// --- SSE Client ---

export type SSEOptions = {
	universe: Universe;
	url: string;
	syncUrl: string;
	optimistic: boolean;
	clientId: string;
	versions: Map<string, number>;
	getLastEventId: () => number;
	onOpen?: () => void;
	onClose?: () => void;
	onEvent?: (event: ZunoStateEvent) => void;
	resolveConflict?: ConflictResolver;
};

export function startSSE(opts: SSEOptions): ZunoTransport {
	const {
		url,
		syncUrl,
		universe,
		clientId,
		versions,
		getLastEventId,
		onEvent,
		resolveConflict,
	} = opts;
	let es: EventSource | null = null;
	let retryCount = 0;

	// Helper to apply state changes
	const applyState = (event: ZunoStateEvent) => {
		if (onEvent) {
			onEvent(event);
		} else {
			// Fallback default implementation
			if (typeof event.version === "number") {
				const current = versions.get(event.storeKey) ?? 0;
				if (event.version <= current) return;
				versions.set(event.storeKey, event.version);
			}
			const store = universe.getStore(event.storeKey, () => event.state);
			if (event.intent) {
				store.apply(event.intent);
			} else {
				store.set(event.state);
			}
		}
	};

	// --- Offline Support ---
	const queue: ZunoStateEvent[] = [];
	let isFlushing = false;

	async function flushQueue() {
		if (isFlushing || queue.length === 0) return;
		if (typeof navigator !== "undefined" && !navigator.onLine) return;

		isFlushing = true;

		// --- Coalesce / Deduplicate Logic ---
		// 1. Map index of first occurrence of each storeKey
		const keyIndex = new Map<string, number>();
		// 2. Reduced queue construction
		const reducedQueue: ZunoStateEvent[] = [];

		for (const event of queue) {
			if (keyIndex.has(event.storeKey)) {
				// We've seen this key before. We want to update the existing entry in reducedQueue.
				// biome-ignore lint/style/noNonNullAssertion: key exists per has check
				const idx = keyIndex.get(event.storeKey)!;
				const prev = reducedQueue[idx];
				// Merge: keep original baseVersion (from the start of the chain) but use NEW state.
				// Note: We also likely want to keep the original 'ts' if strictly ordering,
				// but state is what matters.
				// The 'version' in the event is the *optimistic* version.
				// We can keep the *latest* optimistic version (e.g. v10) in the event,
				// but server will likely only verify baseVersion.
				reducedQueue[idx] = { ...event, baseVersion: prev.baseVersion };
			} else {
				keyIndex.set(event.storeKey, reducedQueue.length);
				reducedQueue.push(event);
			}
		}

		// Replace original queue with reduced one.
		// We modify 'queue' in place or reset it.
		// Since 'queue' is const binding to array, we can't reassign variable,
		// but we can clear and push.
		queue.length = 0;
		queue.push(...reducedQueue);

		try {
			while (queue.length > 0) {
				const event = queue[0];
				try {
					const res = await fetch(syncUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(event),
					});

					if (!res.ok && res.status !== 409) {
						// Keep in queue for retry if it's a transient server error?
						// For now we dequeue on non-network errors to avoid blocking.
						if (res.status >= 400 && res.status < 500) {
							queue.shift();
							continue;
						}
						// For 500, we might want to retry? Let's treat it as network-ish for now.
						// But to be safe and not block forever:
						queue.shift();
						continue;
					}

					if (res.status === 409) {
						const data = await res.json();
						if (data.current) {
							const { state: serverState, version: serverVersion } =
								data.current;

							let nextState = serverState;
							if (resolveConflict) {
								const localState = universe
									.getStore(event.storeKey, () => null)
									.get();
								nextState = resolveConflict(
									localState,
									serverState,
									event.storeKey,
								);
							}

							// versions.set(event.storeKey, serverVersion); // REMOVE THIS

							// 2. Apply resolved state locally
							applyState({
								storeKey: event.storeKey,
								state: nextState,
								version: serverVersion,
								origin: "conflict-resolution",
							});

							// 3. If resolved state differs from server, auto-sync back
							if (JSON.stringify(nextState) !== JSON.stringify(serverState)) {
								queue.unshift({
									...event,
									state: nextState,
									baseVersion: serverVersion,
								});
								continue;
							}
						}
						queue.shift();
					} else if (res.ok) {
						const json = await res.json();
						if (json.event && typeof json.event.version === "number") {
							// Just update version map
							versions.set(event.storeKey, json.event.version);
						}
						queue.shift();
					} else {
						queue.shift();
					}
				} catch (err) {
					console.error("[Zuno] Flush failed, retrying later", err);
					break; // Network error, stop flushing
				}
			}
		} finally {
			isFlushing = false;
		}
	}
	function connect() {
		const lastId = getLastEventId();
		const connectUrl = new URL(url, globalThis.location?.href);
		if (lastId > 0) connectUrl.searchParams.set("lastEventId", String(lastId));

		es = new EventSource(connectUrl.toString());

		// biome-ignore lint/suspicious/noExplicitAny: EventSource data is string, rec is parsed JSON
		es.addEventListener("snapshot", (e: any) => {
			try {
				const snap = JSON.parse(e.data);
				for (const [key, rec] of Object.entries(snap)) {
					// biome-ignore lint/suspicious/noExplicitAny: rec state can be anything
					const r = rec as { state: any; version: number };
					applyState({
						storeKey: key,
						state: r.state,
						version: r.version,
						origin: "server",
					});
				}
			} catch (err) {
				console.error("[Zuno] Failed to parse snapshot", err);
			}
		});

		// biome-ignore lint/suspicious/noExplicitAny: EventSource event data
		es.addEventListener("state", (e: any) => {
			try {
				const event = JSON.parse(e.data) as ZunoStateEvent;
				// If server didn't provide an origin (e.g. manual server-side trigger),
				// we treat it as authoritative "server" origin.
				if (!event.origin) {
					event.origin = "server";
				}

				if (event.origin === clientId) return;

				applyState(event);
			} catch (err) {
				console.error("[Zuno] Failed to parse SSE event", err);
			}
		});

		es.onopen = () => {
			retryCount = 0;
			opts.onOpen?.();
			flushQueue();
		};

		es.onerror = () => {
			es?.close();
			opts.onClose?.();
			const delay = Math.min(1000 * 2 ** retryCount, 30000);
			retryCount++;
			setTimeout(connect, delay);
		};
	}

	if (typeof window !== "undefined") {
		window.addEventListener("online", flushQueue);
	}

	connect();

	const dispatchFn = async (
		event: ZunoStateEvent,
	): Promise<TransportStatus> => {
		try {
			// Removed local application here. Local application is handled by coreDispatch
			// to avoid double-update when intents are used.

			// 1. Optimistic Local Apply
			// This is needed for direct transport usage (like in tests)
			if (opts.optimistic !== false && !event.origin) {
				applyState(event);
			}

			// Check online status first
			if (typeof navigator !== "undefined" && !navigator.onLine) {
				queue.push(event);
				return { ok: false, status: 0, json: null, reason: "OFFLINE_QUEUED" };
			}

			const res = await fetch(syncUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(event),
			});

			if (res.status === 409) {
				const data = await res.json();
				if (data.current) {
					const { state: serverState, version: serverVersion } = data.current;

					let nextState = serverState;
					if (resolveConflict) {
						const localState = universe
							.getStore(event.storeKey, () => null)
							.get();
						nextState = resolveConflict(
							localState,
							serverState,
							event.storeKey,
						);
					}

					applyState({
						storeKey: event.storeKey,
						state: nextState,
						version: serverVersion,
						origin: "conflict-resolution",
					});

					if (JSON.stringify(nextState) !== JSON.stringify(serverState)) {
						return await dispatchFn({
							...event,
							state: nextState,
							baseVersion: serverVersion,
						});
					}
				}
				return { ok: false, status: 409, json: data, reason: "CONFLICT" };
			}

			if (!res.ok)
				return { ok: false, status: res.status, json: await res.json() };

			const json = await res.json();
			if (json.event) {
				const { version } = json.event;
				if (typeof version === "number") {
					versions.set(event.storeKey, version);
				}
			}

			return { ok: true, status: 200, json };
		} catch (err) {
			// Network failure catch
			if (queue.length < 100) {
				queue.push(event);
				setTimeout(flushQueue, 1000);
			}
			return {
				ok: false,
				status: 500,
				json: err,
				reason: "NETWORK_ERROR_QUEUED",
			};
		}
	};

	return {
		dispatch: dispatchFn,
		unsubscribe: () => {
			es?.close();
			if (typeof window !== "undefined") {
				window.removeEventListener("online", flushQueue);
			}
		},
	};
}

// --- BroadcastChannel ---

export type BCOptions = {
	channelName: string;
	clientId: string;
	onEvent: (event: ZunoStateEvent) => void;
	getSnapshot: () => Record<string, { state: unknown; version: number }>;
	onSnapshot: (
		snap: Record<string, { state: unknown; version: number }>,
	) => void;
};

export function startBroadcastChannel(opts: BCOptions) {
	const { channelName, clientId, onEvent, getSnapshot, onSnapshot } = opts;
	const channel = new BroadcastChannel(channelName);

	channel.onmessage = (e) => {
		const msg = e.data;
		if (msg.origin === clientId) return;

		if (msg.type === "event") onEvent(msg.event);
		if (msg.type === "hello")
			channel.postMessage({
				type: "snapshot",
				snapshot: getSnapshot(),
				origin: clientId,
			});
		if (msg.type === "snapshot") onSnapshot(msg.snapshot);
	};

	return {
		publish: (event: ZunoStateEvent) =>
			channel.postMessage({ type: "event", event, origin: clientId }),
		hello: () => channel.postMessage({ type: "hello", origin: clientId }),
		stop: () => channel.close(),
	};
}
