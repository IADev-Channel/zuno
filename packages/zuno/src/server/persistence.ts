import type { ZunoStateEvent } from "../sync";
import type { UniverseRecord } from "./core";

export type ZunoPersistedServerState = {
	universe: Record<string, UniverseRecord>;
	events: ZunoStateEvent[];
	nextEventId: number;
};

export type ZunoCompareAndSetResult =
	| { ok: true; event: ZunoStateEvent }
	| { ok: false; current: UniverseRecord };

/**
 * Authoritative persistence contract for server state and its replay log.
 * `compareAndSet` must atomically validate baseVersion, update state, assign an
 * event ID, and append/truncate the replay log.
 */
export interface ZunoServerPersistence {
	load(): ZunoPersistedServerState;
	save(state: ZunoPersistedServerState): void;
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
	});

const cloneState = (
	state: ZunoPersistedServerState,
): ZunoPersistedServerState => structuredClone(state);

const applyCompareAndSet = (
	state: ZunoPersistedServerState,
	event: ZunoStateEvent,
	maxEvents: number,
): ZunoCompareAndSetResult => {
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
		version: current.version + 1,
		eventId: state.nextEventId++,
	};
	state.universe[event.storeKey] = {
		state: structuredClone(event.state),
		version: authoritativeEvent.version,
	};
	state.events.push(authoritativeEvent);
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
