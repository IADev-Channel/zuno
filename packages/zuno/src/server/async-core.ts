import type { ZunoStateEvent } from "../sync";
import type { ZunoAsyncServerPersistence } from "./async-persistence";
import type { UniverseRecord } from "./core";
import type { ZunoCompareAndSetResult } from "./persistence";

export type CreateAsyncZunoServerStateOptions = {
	persistence: ZunoAsyncServerPersistence;
	maxEvents?: number;
	maxStateBytes?: number;
};

/**
 * Async durable-authority orchestration for network persistence adapters.
 * Transport/listener orchestration remains on the established synchronous
 * server until async handlers are introduced; this class owns only persistence
 * operations so PostgreSQL can be integrated without silently returning
 * promises through synchronous APIs.
 */
export class AsyncZunoServerState {
	readonly maxEvents: number;
	readonly maxStateBytes: number;
	readonly persistence: ZunoAsyncServerPersistence;

	constructor(options: CreateAsyncZunoServerStateOptions) {
		this.maxEvents = options.maxEvents ?? 1000;
		this.maxStateBytes = options.maxStateBytes ?? 512 * 1024;
		if (!Number.isInteger(this.maxEvents) || this.maxEvents < 1)
			throw new TypeError("maxEvents must be a positive integer");
		if (!Number.isInteger(this.maxStateBytes) || this.maxStateBytes < 1)
			throw new TypeError("maxStateBytes must be a positive integer");
		this.persistence = options.persistence;
	}

	getUniverseRecord(storeKey: string): Promise<UniverseRecord | undefined> {
		return this.persistence.getRecord(storeKey);
	}

	getUniverseState(): Promise<Record<string, UniverseRecord>> {
		return this.persistence.getSnapshot();
	}

	getScopedUniverseState(
		partition: string,
		topics: ReadonlySet<string>,
	): Promise<Record<string, UniverseRecord>> {
		return this.persistence.getSnapshot(partition, topics);
	}

	appendEvent(event: ZunoStateEvent): Promise<ZunoStateEvent> {
		return this.persistence.appendEvent(event, this.maxEvents);
	}

	compareAndSet(event: ZunoStateEvent): Promise<ZunoCompareAndSetResult> {
		return this.persistence.compareAndSet(event, this.maxEvents);
	}

	getEventsAfter(lastEventId: number): Promise<ZunoStateEvent[]> {
		return this.persistence.readEvents({ afterEventId: lastEventId });
	}

	getScopedEventsAfter(
		lastEventId: number,
		partition: string,
		topics: ReadonlySet<string>,
	): Promise<ZunoStateEvent[]> {
		return this.persistence.readEvents({
			afterEventId: lastEventId,
			partition,
			topics,
		});
	}

	async getLastEventId(): Promise<number> {
		return (await this.persistence.getReplayBounds()).lastEventId;
	}

	async canReplayAfter(lastEventId: number): Promise<boolean> {
		const bounds = await this.persistence.getReplayBounds();
		if (lastEventId === bounds.lastEventId) return true;
		return (
			typeof bounds.firstEventId === "number" &&
			lastEventId >= bounds.firstEventId - 1 &&
			lastEventId < bounds.lastEventId
		);
	}

	clear(): Promise<void> {
		return this.persistence.clear();
	}
}

export const createAsyncZunoServerState = (
	options: CreateAsyncZunoServerStateOptions,
) => new AsyncZunoServerState(options);
