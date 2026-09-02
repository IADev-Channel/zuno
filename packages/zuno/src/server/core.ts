import type { ZunoStateEvent } from "../sync";
import { parseScopedStoreKey } from "../sync";
import type { ZunoServerEventBus } from "./event-bus";
import {
	createMemoryZunoServerPersistence,
	type ZunoCompareAndSetResult,
	type ZunoServerPersistence,
} from "./persistence";

export type UniverseRecord = { state: unknown; version: number };
export type ZunoStateListener = (event: ZunoStateEvent) => void;
export type ZunoScopedStateListener = ZunoStateListener & {
	partition?: string;
	topics?: ReadonlySet<string>;
};

export type CreateZunoServerStateOptions = {
	maxEvents?: number;
	maxStateBytes?: number;
	maxSubscriberBuffer?: number;
	persistence?: ZunoServerPersistence;
	eventBus?: ZunoServerEventBus;
	instanceId?: string;
};

export class ZunoServerState {
	readonly maxEvents: number;
	readonly maxStateBytes: number;
	readonly maxSubscriberBuffer: number;
	readonly persistence: ZunoServerPersistence;
	readonly instanceId: string;
	private readonly listeners = new Set<ZunoScopedStateListener>();
	private readonly scopedListeners = new Map<
		string,
		Set<ZunoScopedStateListener>
	>();
	private readonly eventBus?: ZunoServerEventBus;
	private unsubscribeFromEventBus?: () => void;

	constructor(options: CreateZunoServerStateOptions = {}) {
		this.maxEvents = options.maxEvents ?? 1000;
		this.maxStateBytes = options.maxStateBytes ?? 512 * 1024;
		this.maxSubscriberBuffer = options.maxSubscriberBuffer ?? 1000;
		if (!Number.isInteger(this.maxEvents) || this.maxEvents < 1)
			throw new TypeError("maxEvents must be a positive integer");
		if (!Number.isInteger(this.maxStateBytes) || this.maxStateBytes < 1)
			throw new TypeError("maxStateBytes must be a positive integer");
		if (
			!Number.isInteger(this.maxSubscriberBuffer) ||
			this.maxSubscriberBuffer < 1
		)
			throw new TypeError("maxSubscriberBuffer must be a positive integer");
		this.persistence =
			options.persistence ?? createMemoryZunoServerPersistence();
		this.eventBus = options.eventBus;
		this.instanceId = options.instanceId ?? crypto.randomUUID();
		this.unsubscribeFromEventBus = this.eventBus?.subscribe((message) => {
			if (message.source === this.instanceId) return;
			const consumed =
				this.eventBus?.getConsumerOffset(this.instanceId, message.partition) ??
				0;
			if (message.offset <= consumed) return;
			this.notifyLocalListeners(message.event);
			this.eventBus?.commitConsumerOffset(
				this.instanceId,
				message.partition,
				message.offset,
			);
		});
	}

	getUniverseRecord(storeKey: string): UniverseRecord | undefined {
		return this.persistence.getRecord(storeKey);
	}
	/** @deprecated Apply mutations through compareAndSet/applyStateEvent. */
	updateUniverseState(event: ZunoStateEvent): void {
		const current = this.persistence.getRecord(event.storeKey);
		this.persistence.compareAndSet(
			{ ...event, baseVersion: current?.version ?? 0 },
			this.maxEvents,
		);
	}
	getUniverseState(): Record<string, UniverseRecord> {
		return this.persistence.getSnapshot();
	}
	getScopedUniverseState(
		partition: string,
		topics: ReadonlySet<string>,
	): Record<string, UniverseRecord> {
		return this.persistence.getSnapshot(partition, topics);
	}
	appendEvent(event: ZunoStateEvent): ZunoStateEvent {
		return this.persistence.appendEvent(event, this.maxEvents);
	}
	compareAndSet(event: ZunoStateEvent): ZunoCompareAndSetResult {
		return this.persistence.compareAndSet(event, this.maxEvents);
	}
	getEventsAfter(lastEventId: number): ZunoStateEvent[] {
		return this.persistence.readEvents({ afterEventId: lastEventId });
	}
	getScopedEventsAfter(
		lastEventId: number,
		partition: string,
		topics: ReadonlySet<string>,
	): ZunoStateEvent[] {
		return this.persistence.readEvents({
			afterEventId: lastEventId,
			partition,
			topics,
		});
	}
	canReplayAfter(lastEventId: number): boolean {
		const latest = this.getLastEventId();
		if (lastEventId === latest) return true;
		const first = this.persistence.getReplayBounds().firstEventId;
		return (
			typeof first === "number" &&
			lastEventId >= first - 1 &&
			lastEventId < latest
		);
	}
	getLastEventId(): number {
		return this.persistence.getReplayBounds().lastEventId;
	}

	subscribeToStateEvents(listener: ZunoStateListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	subscribeToScopedStateEvents(
		partition: string,
		topics: ReadonlySet<string>,
		listener: ZunoStateListener,
	): () => void {
		const scoped = listener as ZunoScopedStateListener;
		scoped.partition = partition;
		scoped.topics = topics;
		for (const topic of topics) {
			const key = `${partition}\u0000${topic}`;
			let listeners = this.scopedListeners.get(key);
			if (!listeners) {
				listeners = new Set();
				this.scopedListeners.set(key, listeners);
			}
			listeners.add(scoped);
		}
		return () => {
			for (const topic of topics) {
				const key = `${partition}\u0000${topic}`;
				const listeners = this.scopedListeners.get(key);
				listeners?.delete(scoped);
				if (listeners?.size === 0) this.scopedListeners.delete(key);
			}
		};
	}
	publishToStateEvent(event: ZunoStateEvent): void {
		this.notifyLocalListeners(event);
		this.eventBus?.publish({ source: this.instanceId, event });
	}
	private notifyLocalListeners(event: ZunoStateEvent): void {
		for (const listener of this.listeners) listener(event);
		const scope = parseScopedStoreKey(event.storeKey);
		if (!scope) return;
		const matches = this.scopedListeners.get(
			`${scope.partition}\u0000${scope.topic}`,
		);
		if (matches) for (const listener of matches) listener(event);
	}
	clear(): void {
		this.persistence.clear();
	}
	dispose(): void {
		this.unsubscribeFromEventBus?.();
		this.unsubscribeFromEventBus = undefined;
		this.listeners.clear();
		this.scopedListeners.clear();
	}
}

export const createZunoServerState = (
	options: CreateZunoServerStateOptions = {},
) => new ZunoServerState(options);
export class ZunoServerRegistry {
	private readonly servers = new Map<string, ZunoServerState>();
	constructor(
		private readonly serverOptions: CreateZunoServerStateOptions = {},
	) {}
	get(namespace: string): ZunoServerState {
		if (namespace.trim().length === 0)
			throw new TypeError("namespace must be a non-empty string");
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
