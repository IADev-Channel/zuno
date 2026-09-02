import type { Universe } from "../core";
import {
	createMemoryOfflineQueue,
	type ZunoOfflineQueue,
} from "./offline-queue";

export type {
	IndexedDBOfflineQueueOptions,
	ZunoOfflineQueue,
} from "./offline-queue";
export {
	createIndexedDBOfflineQueue,
	createMemoryOfflineQueue,
} from "./offline-queue";

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
	state?: unknown;
	/** Optional compact object delta, resolved against authoritative state. */
	delta?: import("./payload").ZunoStateDelta;
	/** Stable retry key. Durable adapters deduplicate it within a partition. */
	idempotencyKey?: string;
	/** Ephemeral events are delivered live but never mutate authoritative state. */
	durability?: "durable" | "ephemeral";
	/** Tombstones delete materialized state while remaining replayable. */
	operation?: "upsert" | "delete";
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

export type ZunoConnectionState =
	| "disabled"
	| "connecting"
	| "connected"
	| "disconnected"
	| "stopped";

export type ZunoStatus = {
	connection: ZunoConnectionState;
	queuedMutations: number;
	retryAttempt: number;
	conflictCount: number;
	lastError?: string;
};

export type ZunoLogEntry = {
	level: "debug" | "info" | "warn" | "error";
	event: string;
	timestamp: number;
	storeKey?: string;
	details?: Record<string, unknown>;
};

export type ZunoMetric = {
	name: string;
	value: number;
	unit: "count" | "milliseconds" | "bytes";
	timestamp: number;
	tags?: Record<string, string>;
};

/**
 * Client transport interface.
 */
export interface ZunoTransport {
	dispatch(event: ZunoStateEvent): Promise<TransportStatus>;
	dispatchBatch?(events: readonly ZunoStateEvent[]): Promise<TransportStatus>;
	pauseDownstream?(): void;
	resumeDownstream?(): void;
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
	setLastEventId?: (id: number) => void;
	/** Maximum number of mutations retained while offline (default: 100). */
	maxQueueSize?: number;
	/** Maximum automatic retries for a single conflict (default: 3). */
	maxConflictRetries?: number;
	/** Random reconnect spread as a fraction of exponential delay (default: 0.2). */
	reconnectJitterRatio?: number;
	/** Maximum reconnect delay including admission backoff (default: 30 seconds). */
	maxReconnectDelayMs?: number;
	/** Gzip mutation requests at or above this encoded size (default: 16 KiB). */
	compressionThresholdBytes?: number;
	/** Start without opening EventSource; used by browser leader election. */
	startPaused?: boolean;
	/** Queue persistence provider (default: an in-memory provider). */
	offlineQueue?: ZunoOfflineQueue;
	onOpen?: () => void;
	onClose?: () => void;
	onEvent?: (event: ZunoStateEvent) => void;
	resolveConflict?: ConflictResolver;
	onStatus?: (change: Partial<ZunoStatus>) => void;
	onLog?: (entry: ZunoLogEntry) => void;
	onMetric?: (metric: ZunoMetric) => void;
};

export function startSSE(opts: SSEOptions): ZunoTransport {
	const {
		url,
		syncUrl,
		universe,
		clientId,
		versions,
		getLastEventId,
		setLastEventId,
		onEvent,
		resolveConflict,
	} = opts;
	const maxQueueSize = opts.maxQueueSize ?? 100;
	const maxConflictRetries = opts.maxConflictRetries ?? 3;
	const reconnectJitterRatio = opts.reconnectJitterRatio ?? 0.2;
	const maxReconnectDelayMs = opts.maxReconnectDelayMs ?? 30_000;
	const compressionThresholdBytes = opts.compressionThresholdBytes ?? 16 * 1024;
	const offlineQueue = opts.offlineQueue ?? createMemoryOfflineQueue();
	if (!Number.isInteger(maxQueueSize) || maxQueueSize < 1) {
		throw new TypeError("maxQueueSize must be a positive integer");
	}
	if (!Number.isInteger(maxConflictRetries) || maxConflictRetries < 0) {
		throw new TypeError("maxConflictRetries must be a non-negative integer");
	}
	if (reconnectJitterRatio < 0 || reconnectJitterRatio > 1)
		throw new TypeError("reconnectJitterRatio must be between 0 and 1");
	if (!Number.isInteger(maxReconnectDelayMs) || maxReconnectDelayMs < 1)
		throw new TypeError("maxReconnectDelayMs must be a positive integer");
	if (
		!Number.isInteger(compressionThresholdBytes) ||
		compressionThresholdBytes < 0
	)
		throw new TypeError(
			"compressionThresholdBytes must be a non-negative integer",
		);
	let es: EventSource | null = null;
	let retryCount = 0;
	let stopped = false;
	let downstreamPaused = opts.startPaused ?? false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let flushTimer: ReturnType<typeof setTimeout> | null = null;
	const updateStatus = (change: Partial<ZunoStatus>) => opts.onStatus?.(change);
	const log = (
		level: ZunoLogEntry["level"],
		event: string,
		details?: Record<string, unknown>,
	) => {
		try {
			opts.onLog?.({ level, event, timestamp: Date.now(), details });
		} catch (error) {
			console.error("[Zuno] Log hook failed", error);
		}
	};
	const metric = (name: string, value = 1, tags?: Record<string, string>) => {
		try {
			opts.onMetric?.({
				name,
				value,
				unit: "count",
				timestamp: Date.now(),
				tags,
			});
		} catch (error) {
			console.error("[Zuno] Metric hook failed", error);
		}
	};
	const bytesMetric = (
		name: string,
		value: number,
		tags?: Record<string, string>,
	) => {
		try {
			opts.onMetric?.({
				name,
				value,
				unit: "bytes",
				timestamp: Date.now(),
				tags,
			});
		} catch (error) {
			console.error("[Zuno] Metric hook failed", error);
		}
	};
	const encodeMutationBody = async (value: unknown) => {
		const json = JSON.stringify(value);
		const input = new TextEncoder().encode(json);
		if (
			input.byteLength < compressionThresholdBytes ||
			typeof CompressionStream === "undefined"
		)
			return {
				body: json as BodyInit,
				headers: { "Content-Type": "application/json" } as Record<
					string,
					string
				>,
				bytes: input.byteLength,
				compressed: false,
			};
		const stream = new Blob([input])
			.stream()
			.pipeThrough(new CompressionStream("gzip"));
		const body = await new Response(stream).arrayBuffer();
		return {
			body,
			headers: {
				"Content-Encoding": "gzip",
				"Content-Type": "application/json",
			} as Record<string, string>,
			bytes: body.byteLength,
			compressed: true,
		};
	};
	const postMutation = async (value: unknown) => {
		const encoded = await encodeMutationBody(value);
		bytesMetric("zuno.transport.bytes_sent", encoded.bytes, {
			encoding: encoded.compressed ? "gzip" : "identity",
		});
		return fetch(syncUrl, {
			method: "POST",
			headers: encoded.headers,
			body: encoded.body,
		});
	};

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
	let queueStorageHealthy = true;
	const reportQueueStorageError = (error: unknown) => {
		queueStorageHealthy = false;
		updateStatus({ lastError: "QUEUE_STORAGE_ERROR" });
		log("error", "queue.storage_error", { error: String(error) });
		metric("zuno.queue.storage_errors");
		console.error("[Zuno] Offline queue storage failed", error);
	};
	const queueReady = offlineQueue
		.load()
		.then(async (storedEvents) => {
			queue.push(...storedEvents.slice(0, maxQueueSize));
			updateStatus({ queuedMutations: queue.length });
			if (storedEvents.length > maxQueueSize) {
				try {
					await offlineQueue.save(queue);
				} catch (error) {
					reportQueueStorageError(error);
				}
			}
		})
		.catch(reportQueueStorageError);
	const conflictRetries = new Map<string, number>();
	let isFlushing = false;
	const persistQueue = async () => {
		updateStatus({ queuedMutations: queue.length });
		try {
			await offlineQueue.save(queue);
			queueStorageHealthy = true;
			return true;
		} catch (error) {
			reportQueueStorageError(error);
			return false;
		}
	};
	const enqueue = async (event: ZunoStateEvent) => {
		await queueReady;
		if (!queueStorageHealthy) return "storage-error" as const;
		if (queue.length >= maxQueueSize) return "full" as const;
		queue.push(event);
		if (!(await persistQueue())) {
			queue.pop();
			updateStatus({ queuedMutations: queue.length });
			return "storage-error" as const;
		}
		updateStatus({ queuedMutations: queue.length });
		metric("zuno.queue.enqueued", 1, { storeKey: event.storeKey });
		return "queued" as const;
	};
	const queueReason = (
		result: "queued" | "full" | "storage-error",
		queuedReason: string,
	) => {
		if (result === "queued") return queuedReason;
		if (result === "full") return "QUEUE_FULL";
		return "QUEUE_STORAGE_ERROR";
	};
	const scheduleFlush = () => {
		if (stopped || flushTimer) return;
		flushTimer = setTimeout(() => {
			flushTimer = null;
			void flushQueue();
		}, 1000);
	};

	async function flushQueue() {
		if (stopped) return;
		await queueReady;
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
		updateStatus({ queuedMutations: queue.length });
		await persistQueue();

		try {
			while (queue.length > 0) {
				const event = queue[0];
				try {
					const res = await postMutation(event);

					if (!res.ok && res.status !== 409) {
						if (res.status >= 400 && res.status < 500) {
							queue.shift();
							await persistQueue();
							continue;
						}
						// Preserve retryable server failures at the front of the queue.
						scheduleFlush();
						break;
					}

					if (res.status === 409) {
						metric("zuno.conflicts", 1, { storeKey: event.storeKey });
						updateStatus({ lastError: "CONFLICT" });
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
								const attempts = (conflictRetries.get(event.storeKey) ?? 0) + 1;
								if (attempts > maxConflictRetries) {
									conflictRetries.delete(event.storeKey);
									queue.shift();
									await persistQueue();
									continue;
								}
								conflictRetries.set(event.storeKey, attempts);
								queue.unshift({
									...event,
									state: nextState,
									baseVersion: serverVersion,
								});
								continue;
							}
						}
						queue.shift();
						await persistQueue();
					} else if (res.ok) {
						conflictRetries.delete(event.storeKey);
						const json = await res.json();
						if (json.event && typeof json.event.version === "number") {
							// Just update version map
							versions.set(event.storeKey, json.event.version);
						}
						queue.shift();
						await persistQueue();
					} else {
						queue.shift();
						await persistQueue();
					}
				} catch (err) {
					updateStatus({ lastError: "QUEUE_FLUSH_FAILED" });
					log("warn", "queue.flush_failed", { error: String(err) });
					console.error("[Zuno] Flush failed, retrying later", err);
					scheduleFlush();
					break; // Network error, stop flushing
				}
			}
		} finally {
			isFlushing = false;
		}
	}
	function scheduleReconnect(lastError: string) {
		if (stopped || downstreamPaused || reconnectTimer) return;
		const baseDelay = Math.min(1000 * 2 ** retryCount, maxReconnectDelayMs);
		const delay = Math.min(
			maxReconnectDelayMs,
			Math.round(baseDelay + Math.random() * baseDelay * reconnectJitterRatio),
		);
		retryCount++;
		updateStatus({
			connection: "disconnected",
			retryAttempt: retryCount,
			lastError,
		});
		log("warn", "connection.retry_scheduled", {
			delay,
			retryAttempt: retryCount,
		});
		metric("zuno.connection.retries");
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, delay);
	}
	function connect() {
		if (stopped || downstreamPaused || es) return;
		updateStatus({ connection: "connecting" });
		const lastId = getLastEventId();
		const connectUrl = new URL(url, globalThis.location?.href);
		if (lastId > 0) connectUrl.searchParams.set("lastEventId", String(lastId));

		es = new EventSource(connectUrl.toString());

		// biome-ignore lint/suspicious/noExplicitAny: EventSource data is string, rec is parsed JSON
		es.addEventListener("snapshot", (e: any) => {
			try {
				const snapshotEventId = Number.parseInt(e.lastEventId || "0", 10);
				if (snapshotEventId >= 0) setLastEventId?.(snapshotEventId);
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
				// Preserve origin only long enough to suppress our own loopback. Every
				// event received over SSE was accepted by the authority and must be able
				// to replace an offline replica's higher optimistic version.
				if (event.origin === clientId) return;
				event.origin = "server";

				applyState(event);
			} catch (err) {
				console.error("[Zuno] Failed to parse SSE event", err);
			}
		});

		// A gateway sends this before evicting a slow consumer or draining.
		// Clearing the cursor forces the next gateway to send a fresh snapshot.
		es.addEventListener("control", (e: MessageEvent<string>) => {
			try {
				const control = JSON.parse(e.data) as {
					type?: string;
					reason?: string;
				};
				if (control.type !== "RESYNC_REQUIRED") return;
				setLastEventId?.(0);
				updateStatus({ lastError: "RESYNC_REQUIRED" });
				log("warn", "connection.resync_required", { reason: control.reason });
				metric("zuno.connection.resync_required", 1, {
					reason: control.reason ?? "unknown",
				});
				es?.close();
				es = null;
				scheduleReconnect("RESYNC_REQUIRED");
			} catch (err) {
				log("warn", "connection.invalid_control", { error: String(err) });
			}
		});

		es.onopen = () => {
			if (stopped) return;
			retryCount = 0;
			updateStatus({
				connection: "connected",
				retryAttempt: 0,
				lastError: undefined,
			});
			log("info", "connection.open");
			metric("zuno.connection.opened");
			opts.onOpen?.();
			flushQueue();
		};

		es.onerror = () => {
			es?.close();
			es = null;
			if (stopped) return;
			opts.onClose?.();
			scheduleReconnect("SSE_DISCONNECTED");
		};
	}

	if (typeof window !== "undefined") {
		window.addEventListener("online", flushQueue);
	}

	if (!downstreamPaused) connect();

	const dispatchFn = async (
		event: ZunoStateEvent,
		conflictAttempt = 0,
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
				const queued = await enqueue(event);
				return {
					ok: false,
					status: 0,
					json: null,
					reason: queueReason(queued, "OFFLINE_QUEUED"),
				};
			}

			const res = await postMutation(event);

			if (res.status === 409) {
				metric("zuno.conflicts", 1, { storeKey: event.storeKey });
				updateStatus({ lastError: "CONFLICT" });
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
						if (conflictAttempt >= maxConflictRetries) {
							return {
								ok: false,
								status: 409,
								json: data,
								reason: "CONFLICT_RETRY_LIMIT",
							};
						}
						return await dispatchFn(
							{
								...event,
								state: nextState,
								baseVersion: serverVersion,
							},
							conflictAttempt + 1,
						);
					}
				}
				return { ok: false, status: 409, json: data, reason: "CONFLICT" };
			}

			if (!res.ok) {
				const json = await res.json();
				if (res.status >= 500) {
					const queued = await enqueue(event);
					if (queued === "queued") scheduleFlush();
					return {
						ok: false,
						status: res.status,
						json,
						reason: queueReason(queued, "SERVER_ERROR_QUEUED"),
					};
				}
				return { ok: false, status: res.status, json };
			}

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
			const queued = await enqueue(event);
			if (queued === "queued") scheduleFlush();
			return {
				ok: false,
				status: 500,
				json: err,
				reason: queueReason(queued, "NETWORK_ERROR_QUEUED"),
			};
		}
	};
	const dispatchBatch = async (
		events: readonly ZunoStateEvent[],
	): Promise<TransportStatus> => {
		if (events.length === 0)
			return { ok: true, status: 200, json: { ok: true, results: [] } };
		if (events.length === 1) return dispatchFn(events[0]);
		try {
			const res = await postMutation({ events });
			const json = await res.json();
			for (const [index, result] of (json.results ?? []).entries()) {
				if (result.ok && typeof result.event?.version === "number")
					versions.set(result.event.storeKey, result.event.version);
				else if (result.current)
					applyState({
						storeKey: events[index]?.storeKey ?? "",
						state: result.current.state,
						version: result.current.version,
						origin: "conflict-resolution",
					});
			}
			if (res.ok) {
				metric("zuno.batch.requests");
				metric("zuno.batch.mutations", events.length);
				return { ok: true, status: res.status, json };
			}
			return {
				ok: false,
				status: res.status,
				json,
				reason: res.status === 409 ? "BATCH_CONFLICT" : undefined,
			};
		} catch (error) {
			for (const event of events) await enqueue(event);
			return { ok: false, status: 500, json: error, reason: "BATCH_QUEUED" };
		}
	};

	return {
		dispatch: dispatchFn,
		dispatchBatch,
		pauseDownstream() {
			downstreamPaused = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			reconnectTimer = null;
			es?.close();
			es = null;
		},
		resumeDownstream() {
			if (stopped || !downstreamPaused) return;
			downstreamPaused = false;
			connect();
		},
		unsubscribe: () => {
			stopped = true;
			updateStatus({ connection: "stopped", retryAttempt: 0 });
			log("info", "connection.stopped");
			es?.close();
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (flushTimer) clearTimeout(flushTimer);
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
export * from "./payload";
export * from "./subscriptions";
export * from "./websocket";
