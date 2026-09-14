import type { ZunoStateEvent } from "../sync";
import type { UniverseRecord } from "./core";
import type {
	ZunoCompactionPolicy,
	ZunoCompareAndSetResult,
	ZunoReplayBounds,
	ZunoReplayQuery,
	ZunoServerPersistence,
} from "./persistence";

/**
 * Persistence contract for authorities backed by asynchronous/network storage.
 *
 * This deliberately lives beside the synchronous contract instead of widening
 * `ZunoServerPersistence` to promises. Existing memory/file/SQLite users keep
 * their synchronous API and error timing while remote adapters can be awaited
 * explicitly by async server orchestration.
 */
export interface ZunoAsyncServerPersistence {
	getRecord(storeKey: string): Promise<UniverseRecord | undefined>;
	getSnapshot(
		partition?: string,
		topics?: ReadonlySet<string>,
	): Promise<Record<string, UniverseRecord>>;
	readEvents(query: ZunoReplayQuery): Promise<ZunoStateEvent[]>;
	getReplayBounds(): Promise<ZunoReplayBounds>;
	appendEvent(event: ZunoStateEvent, maxEvents: number): Promise<ZunoStateEvent>;
	compact(policy: ZunoCompactionPolicy, now?: number): Promise<number>;
	clear(): Promise<void>;
	compareAndSet(
		event: ZunoStateEvent,
		maxEvents: number,
	): Promise<ZunoCompareAndSetResult>;
}

/**
 * Lift an existing synchronous persistence implementation into the async
 * contract. Useful for shared contract tests and incremental migration without
 * changing the established synchronous server surface.
 */
export const asAsyncZunoServerPersistence = (
	persistence: ZunoServerPersistence,
): ZunoAsyncServerPersistence => ({
	async getRecord(storeKey) {
		return persistence.getRecord(storeKey);
	},
	async getSnapshot(partition, topics) {
		return persistence.getSnapshot(partition, topics);
	},
	async readEvents(query) {
		return persistence.readEvents(query);
	},
	async getReplayBounds() {
		return persistence.getReplayBounds();
	},
	async appendEvent(event, maxEvents) {
		return persistence.appendEvent(event, maxEvents);
	},
	async compact(policy, now) {
		return persistence.compact(policy, now);
	},
	async clear() {
		persistence.clear();
	},
	async compareAndSet(event, maxEvents) {
		return persistence.compareAndSet(event, maxEvents);
	},
});
