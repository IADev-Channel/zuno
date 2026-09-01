import type { ZunoStateEvent } from "../sync";
import type { UniverseRecord } from "./core";

export type ZunoPersistedServerState = {
	universe: Record<string, UniverseRecord>;
	events: ZunoStateEvent[];
	nextEventId: number;
	idempotency: Record<string, ZunoStateEvent>;
};

export type ZunoCompareAndSetResult =
	| { ok: true; event: ZunoStateEvent; duplicate?: boolean }
	| { ok: false; current: UniverseRecord };

export type ZunoReplayQuery = {
	afterEventId: number;
	partition?: string;
	topics?: ReadonlySet<string>;
	limit?: number;
};

export type ZunoReplayBounds = { firstEventId?: number; lastEventId: number };

export type ZunoCompactionPolicy = {
	maxEvents: number;
	retentionMs?: number;
	tombstoneRetentionMs?: number;
};

/**
 * Authoritative persistence contract for server state and its replay log.
 * `compareAndSet` must atomically validate baseVersion, update state, assign an
 * event ID, and append/truncate the replay log.
 */
export interface ZunoServerPersistence {
	getRecord(storeKey: string): UniverseRecord | undefined;
	getSnapshot(
		partition?: string,
		topics?: ReadonlySet<string>,
	): Record<string, UniverseRecord>;
	readEvents(query: ZunoReplayQuery): ZunoStateEvent[];
	getReplayBounds(): ZunoReplayBounds;
	appendEvent(event: ZunoStateEvent, maxEvents: number): ZunoStateEvent;
	compact(policy: ZunoCompactionPolicy, now?: number): number;
	clear(): void;
	compareAndSet(
		event: ZunoStateEvent,
		maxEvents: number,
	): ZunoCompareAndSetResult;
}

export const createEmptyPersistedServerState =
	(): ZunoPersistedServerState => ({
		universe: {},
		events: [],
		nextEventId: 1,
		idempotency: {},
	});

const cloneState = (
	state: ZunoPersistedServerState,
): ZunoPersistedServerState => structuredClone(state);

const applyCompareAndSet = (
	state: ZunoPersistedServerState,
	event: ZunoStateEvent,
	maxEvents: number,
): ZunoCompareAndSetResult => {
	state.idempotency ??= {};
	const partition = event.storeKey.split(":", 1)[0] ?? "";
	const idempotencyIndex = event.idempotencyKey
		? `${partition}\u0000${event.idempotencyKey}`
		: undefined;
	if (idempotencyIndex && state.idempotency[idempotencyIndex]) {
		return {
			ok: true,
			event: structuredClone(state.idempotency[idempotencyIndex]),
			duplicate: true,
		};
	}
	const current = state.universe[event.storeKey] ?? {
		state: undefined,
		version: 0,
	};
	if (
		typeof event.baseVersion === "number" &&
		event.baseVersion !== current.version
	) {
		return { ok: false, current: structuredClone(current) };
	}

	const authoritativeEvent = {
		...structuredClone(event),
		durability: "durable" as const,
		operation: event.operation ?? ("upsert" as const),
		ts: event.ts ?? Date.now(),
		version: current.version + 1,
		eventId: state.nextEventId++,
	};
	if (authoritativeEvent.operation === "delete") {
		delete state.universe[event.storeKey];
	} else {
		state.universe[event.storeKey] = {
			state: structuredClone(event.state),
			version: authoritativeEvent.version,
		};
	}
	state.events.push(authoritativeEvent);
	if (idempotencyIndex)
		state.idempotency[idempotencyIndex] = authoritativeEvent;
	if (state.events.length > maxEvents) {
		state.events.splice(0, state.events.length - maxEvents);
	}
	return { ok: true, event: structuredClone(authoritativeEvent) };
};

/** In-memory authoritative persistence for development and tests. */
export class MemoryZunoServerPersistence implements ZunoServerPersistence {
	private state: ZunoPersistedServerState;

	constructor(initialState = createEmptyPersistedServerState()) {
		this.state = cloneState(initialState);
	}

	load(): ZunoPersistedServerState {
		return cloneState(this.state);
	}

	getRecord(storeKey: string): UniverseRecord | undefined {
		const record = this.state.universe[storeKey];
		return record ? structuredClone(record) : undefined;
	}

	getSnapshot(
		partition?: string,
		topics?: ReadonlySet<string>,
	): Record<string, UniverseRecord> {
		const snapshot: Record<string, UniverseRecord> = {};
		for (const [key, record] of Object.entries(this.state.universe)) {
			const [keyPartition, topic] = key.split(":");
			if (
				(!partition || partition === keyPartition) &&
				(!topics || topics.has(topic))
			)
				snapshot[key] = record;
		}
		return structuredClone(snapshot);
	}

	readEvents(query: ZunoReplayQuery): ZunoStateEvent[] {
		return this.state.events
			.filter((event) => {
				if ((event.eventId ?? 0) <= query.afterEventId) return false;
				if (!query.partition && !query.topics) return true;
				const [partition, topic] = event.storeKey.split(":");
				return (
					(!query.partition || partition === query.partition) &&
					(!query.topics || query.topics.has(topic))
				);
			})
			.slice(0, query.limit)
			.map((event) => structuredClone(event));
	}

	getReplayBounds(): ZunoReplayBounds {
		return {
			firstEventId: this.state.events[0]?.eventId,
			lastEventId: this.state.events.at(-1)?.eventId ?? 0,
		};
	}

	appendEvent(event: ZunoStateEvent, maxEvents: number): ZunoStateEvent {
		const authoritative = {
			...structuredClone(event),
			eventId: this.state.nextEventId++,
			ts: event.ts ?? Date.now(),
		};
		this.state.events.push(authoritative);
		this.state.events = this.state.events.slice(-maxEvents);
		return structuredClone(authoritative);
	}

	compact(policy: ZunoCompactionPolicy, now = Date.now()): number {
		const before = this.state.events.length;
		const retained = this.state.events.filter((event) => {
			const age = now - (event.ts ?? now);
			const retention =
				event.operation === "delete"
					? policy.tombstoneRetentionMs
					: policy.retentionMs;
			return retention === undefined || age <= retention;
		});
		this.state.events = retained.slice(-policy.maxEvents);
		return before - this.state.events.length;
	}

	clear(): void {
		this.state = createEmptyPersistedServerState();
	}

	save(state: ZunoPersistedServerState): void {
		this.state = cloneState(state);
	}

	compareAndSet(
		event: ZunoStateEvent,
		maxEvents: number,
	): ZunoCompareAndSetResult {
		const result = applyCompareAndSet(this.state, event, maxEvents);
		return structuredClone(result);
	}
}

export const createMemoryZunoServerPersistence = (
	initialState?: ZunoPersistedServerState,
) => new MemoryZunoServerPersistence(initialState);

export { applyCompareAndSet };
