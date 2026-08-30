import type { ZunoStateEvent } from "../sync";
import type { ZunoServerEventBus } from "./event-bus";
import {
	createEmptyPersistedServerState,
	createMemoryZunoServerPersistence,
	type ZunoCompareAndSetResult,
	type ZunoServerPersistence,
} from "./persistence";

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
	/** Maximum events buffered for a slow SSE subscriber. */
	maxSubscriberBuffer?: number;
	/** Authoritative state and replay-log persistence. */
	persistence?: ZunoServerPersistence;
	/** Shared fan-out bus for other server instances using the same persistence. */
	eventBus?: ZunoServerEventBus;
	/** Stable identifier used to suppress event-bus loopback. */
	instanceId?: string;
};

/**
 * Isolated authoritative state used by server adapters.
 * Create one instance per application, namespace, or tenant boundary.
 */
export class ZunoServerState {
	readonly maxEvents: number;
	readonly maxStateBytes: number;
	readonly maxSubscriberBuffer: number;
	readonly persistence: ZunoServerPersistence;
	readonly instanceId: string;
	private readonly listeners = new Set<ZunoStateListener>();
	private readonly eventBus?: ZunoServerEventBus;
	private unsubscribeFromEventBus?: () => void;

	constructor(options: CreateZunoServerStateOptions = {}) {
		const maxEvents = options.maxEvents ?? 1000;
		const maxStateBytes = options.maxStateBytes ?? 512 * 1024;
		const maxSubscriberBuffer = options.maxSubscriberBuffer ?? 1000;
		if (!Number.isInteger(maxEvents) || maxEvents < 1) {
			throw new TypeError("maxEvents must be a positive integer");
		}
		if (!Number.isInteger(maxStateBytes) || maxStateBytes < 1) {
			throw new TypeError("maxStateBytes must be a positive integer");
		}
		if (!Number.isInteger(maxSubscriberBuffer) || maxSubscriberBuffer < 1) {
			throw new TypeError("maxSubscriberBuffer must be a positive integer");
		}
		this.maxEvents = maxEvents;
		this.maxStateBytes = maxStateBytes;
		this.maxSubscriberBuffer = maxSubscriberBuffer;
		this.persistence =
			options.persistence ?? createMemoryZunoServerPersistence();
		this.eventBus = options.eventBus;
		this.instanceId = options.instanceId ?? crypto.randomUUID();
		this.unsubscribeFromEventBus = this.eventBus?.subscribe((message) => {
			if (message.source === this.instanceId) return;
			this.notifyLocalListeners(message.event);
		});
	}

	getUniverseRecord(storeKey: string): UniverseRecord | undefined {
		return this.persistence.load().universe[storeKey];
	}

	updateUniverseState(event: ZunoStateEvent): void {
		const persisted = this.persistence.load();
		const current = persisted.universe[event.storeKey] ?? {
			state: undefined,
			version: 0,
		};
		const nextVersion =
			typeof event.version === "number" ? event.version : current.version + 1;
		persisted.universe[event.storeKey] = {
			state: event.state,
			version: nextVersion,
		};
		this.persistence.save(persisted);
	}

	getUniverseState(): Record<string, UniverseRecord> {
		return this.persistence.load().universe;
	}

	appendEvent(event: ZunoStateEvent): ZunoStateEvent {
		const persisted = this.persistence.load();
		event.eventId = persisted.nextEventId++;
		persisted.events.push(event);
		if (persisted.events.length > this.maxEvents) {
			persisted.events.splice(0, persisted.events.length - this.maxEvents);
		}
		this.persistence.save(persisted);
		return event;
	}

	compareAndSet(event: ZunoStateEvent): ZunoCompareAndSetResult {
		return this.persistence.compareAndSet(event, this.maxEvents);
	}

	getEventsAfter(lastEventId: number): ZunoStateEvent[] {
		return this.persistence
			.load()
			.events.filter((event) => (event.eventId ?? 0) > lastEventId);
	}

	canReplayAfter(lastEventId: number): boolean {
		const latest = this.getLastEventId();
		if (lastEventId === latest) return true;
		const first = this.persistence.load().events[0]?.eventId;
		return (
			typeof first === "number" &&
			lastEventId >= first - 1 &&
			lastEventId < latest
		);
	}

	getLastEventId(): number {
		const events = this.persistence.load().events;
		return events[events.length - 1]?.eventId ?? 0;
	}

	subscribeToStateEvents(listener: ZunoStateListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	publishToStateEvent(event: ZunoStateEvent): void {
		this.notifyLocalListeners(event);
		this.eventBus?.publish({ source: this.instanceId, event });
	}

	private notifyLocalListeners(event: ZunoStateEvent): void {
		this.listeners.forEach((listener) => {
			listener(event);
		});
	}

	clear(): void {
		this.persistence.save(createEmptyPersistedServerState());
	}

	dispose(): void {
		this.unsubscribeFromEventBus?.();
		this.unsubscribeFromEventBus = undefined;
		this.listeners.clear();
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
