import type { ZunoStateEvent } from "../sync";

export type UniverseRecord = {
	state: unknown;
	version: number;
};

export type ZunoStateListener = (event: ZunoStateEvent) => void;

export type CreateZunoServerStateOptions = {
	/** Maximum number of authoritative events retained for SSE replay. */
	maxEvents?: number;
	/** Maximum serialized state size accepted per event. */
	maxStateBytes?: number;
};

/**
 * Isolated authoritative state used by server adapters.
 * Create one instance per application, namespace, or tenant boundary.
 */
export class ZunoServerState {
	readonly maxEvents: number;
	readonly maxStateBytes: number;
	private readonly universeState = new Map<string, UniverseRecord>();
	private readonly eventLog: ZunoStateEvent[] = [];
	private readonly listeners = new Set<ZunoStateListener>();
	private nextEventId = 1;

	constructor(options: CreateZunoServerStateOptions = {}) {
		const maxEvents = options.maxEvents ?? 1000;
		const maxStateBytes = options.maxStateBytes ?? 512 * 1024;
		if (!Number.isInteger(maxEvents) || maxEvents < 1) {
			throw new TypeError("maxEvents must be a positive integer");
		}
		if (!Number.isInteger(maxStateBytes) || maxStateBytes < 1) {
			throw new TypeError("maxStateBytes must be a positive integer");
		}
		this.maxEvents = maxEvents;
		this.maxStateBytes = maxStateBytes;
	}

	getUniverseRecord(storeKey: string): UniverseRecord | undefined {
		return this.universeState.get(storeKey);
	}

	updateUniverseState(event: ZunoStateEvent): void {
		const current = this.universeState.get(event.storeKey) ?? {
			state: undefined,
			version: 0,
		};
		const nextVersion =
			typeof event.version === "number" ? event.version : current.version + 1;
		this.universeState.set(event.storeKey, {
			state: event.state,
			version: nextVersion,
		});
	}

	getUniverseState(): Record<string, UniverseRecord> {
		return Object.fromEntries(this.universeState);
	}

	appendEvent(event: ZunoStateEvent): ZunoStateEvent {
		event.eventId = this.nextEventId++;
		this.eventLog.push(event);
		if (this.eventLog.length > this.maxEvents) {
			this.eventLog.shift();
		}
		return event;
	}

	getEventsAfter(lastEventId: number): ZunoStateEvent[] {
		return this.eventLog.filter((event) => (event.eventId ?? 0) > lastEventId);
	}

	getLastEventId(): number {
		return this.eventLog[this.eventLog.length - 1]?.eventId ?? 0;
	}

	subscribeToStateEvents(listener: ZunoStateListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	publishToStateEvent(event: ZunoStateEvent): void {
		this.listeners.forEach((listener) => {
			listener(event);
		});
	}

	clear(): void {
		this.universeState.clear();
		this.eventLog.length = 0;
		this.nextEventId = 1;
	}
}

export const createZunoServerState = (
	options: CreateZunoServerStateOptions = {},
) => new ZunoServerState(options);

/** Lazily creates isolated server states for application namespaces or tenants. */
export class ZunoServerRegistry {
	private readonly servers = new Map<string, ZunoServerState>();

	constructor(
		private readonly serverOptions: CreateZunoServerStateOptions = {},
	) {}

	get(namespace: string): ZunoServerState {
		if (namespace.trim().length === 0) {
			throw new TypeError("namespace must be a non-empty string");
		}
		let server = this.servers.get(namespace);
		if (!server) {
			server = createZunoServerState(this.serverOptions);
			this.servers.set(namespace, server);
		}
		return server;
	}

	delete(namespace: string): boolean {
		return this.servers.delete(namespace);
	}

	clear(): void {
		this.servers.clear();
	}
}

export const createZunoServerRegistry = (
	options: CreateZunoServerStateOptions = {},
) => new ZunoServerRegistry(options);

/** Backward-compatible singleton used by the original module-level helpers. */
export const defaultZunoServerState = createZunoServerState();

export const getUniverseRecord = (storeKey: string) =>
	defaultZunoServerState.getUniverseRecord(storeKey);
export const updateUniverseState = (event: ZunoStateEvent) =>
	defaultZunoServerState.updateUniverseState(event);
export const getUniverseState = () => defaultZunoServerState.getUniverseState();
export const appendEvent = (event: ZunoStateEvent) =>
	defaultZunoServerState.appendEvent(event);
export const getEventsAfter = (lastEventId: number) =>
	defaultZunoServerState.getEventsAfter(lastEventId);
export const getLastEventId = () => defaultZunoServerState.getLastEventId();
export const subscribeToStateEvents = (listener: ZunoStateListener) =>
	defaultZunoServerState.subscribeToStateEvents(listener);
export const publishToStateEvent = (event: ZunoStateEvent) =>
	defaultZunoServerState.publishToStateEvent(event);
