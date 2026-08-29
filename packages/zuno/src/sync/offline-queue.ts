import type { ZunoStateEvent } from "./index";

/** Storage contract used by the SSE client to persist queued mutations. */
export interface ZunoOfflineQueue {
	load(): Promise<ZunoStateEvent[]>;
	save(events: readonly ZunoStateEvent[]): Promise<void>;
}

/** In-memory queue storage. Useful as the default and for custom integrations/tests. */
export function createMemoryOfflineQueue(
	initialEvents: readonly ZunoStateEvent[] = [],
): ZunoOfflineQueue {
	let events: ZunoStateEvent[] = structuredClone([...initialEvents]);
	return {
		async load() {
			return structuredClone(events);
		},
		async save(nextEvents) {
			events = structuredClone([...nextEvents]);
		},
	};
}

export type IndexedDBOfflineQueueOptions = {
	/** IndexedDB database name (default: "zuno"). */
	databaseName?: string;
	/** Object-store name (default: "offline-queues"). */
	storeName?: string;
	/** Key used for this client/namespace queue (default: "default"). */
	queueKey?: string;
	/** IndexedDB schema version (default: 1). */
	version?: number;
};

/** Creates durable browser queue storage backed by IndexedDB. */
export function createIndexedDBOfflineQueue(
	options: IndexedDBOfflineQueueOptions = {},
): ZunoOfflineQueue {
	const databaseName = options.databaseName ?? "zuno";
	const storeName = options.storeName ?? "offline-queues";
	const queueKey = options.queueKey ?? "default";
	const version = options.version ?? 1;
	if (!Number.isInteger(version) || version < 1) {
		throw new TypeError("version must be a positive integer");
	}

	let databasePromise: Promise<IDBDatabase> | undefined;
	const getDatabase = () => {
		if (typeof indexedDB === "undefined") {
			return Promise.reject(
				new Error("IndexedDB is not available in this environment"),
			);
		}
		if (!databasePromise) {
			databasePromise = new Promise((resolve, reject) => {
				const request = indexedDB.open(databaseName, version);
				request.onupgradeneeded = () => {
					if (!request.result.objectStoreNames.contains(storeName)) {
						request.result.createObjectStore(storeName);
					}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				request.onblocked = () =>
					reject(new Error(`IndexedDB database "${databaseName}" is blocked`));
			});
		}
		return databasePromise;
	};

	return {
		async load() {
			const database = await getDatabase();
			return await new Promise<ZunoStateEvent[]>((resolve, reject) => {
				const request = database
					.transaction(storeName, "readonly")
					.objectStore(storeName)
					.get(queueKey);
				request.onsuccess = () =>
					resolve(Array.isArray(request.result) ? request.result : []);
				request.onerror = () => reject(request.error);
			});
		},
		async save(events) {
			const database = await getDatabase();
			await new Promise<void>((resolve, reject) => {
				const transaction = database.transaction(storeName, "readwrite");
				transaction.objectStore(storeName).put([...events], queueKey);
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(transaction.error);
			});
		},
	};
}
