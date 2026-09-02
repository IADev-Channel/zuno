import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { ZunoStateEvent } from "../sync";
import type { UniverseRecord } from "./core";
import {
	applyCompareAndSet,
	createEmptyPersistedServerState,
	type ZunoCompactionPolicy,
	type ZunoCompareAndSetResult,
	type ZunoPersistedServerState,
	type ZunoReplayBounds,
	type ZunoReplayQuery,
	type ZunoServerPersistence,
} from "./persistence";

export type FileZunoServerPersistenceOptions = {
	lockTimeoutMs?: number;
	staleLockMs?: number;
};

/** Durable JSON reference adapter with an atomic rename and cross-process lock. */
export class FileZunoServerPersistence implements ZunoServerPersistence {
	private readonly lockPath: string;
	private readonly lockTimeoutMs: number;
	private readonly staleLockMs: number;

	constructor(
		private readonly filePath: string,
		options: FileZunoServerPersistenceOptions = {},
	) {
		this.lockPath = `${filePath}.lock`;
		this.lockTimeoutMs = options.lockTimeoutMs ?? 5000;
		this.staleLockMs = options.staleLockMs ?? 30000;
		if (!Number.isInteger(this.lockTimeoutMs) || this.lockTimeoutMs < 1) {
			throw new TypeError("lockTimeoutMs must be a positive integer");
		}
		if (!Number.isInteger(this.staleLockMs) || this.staleLockMs < 1) {
			throw new TypeError("staleLockMs must be a positive integer");
		}
		mkdirSync(dirname(filePath), { recursive: true });
	}

	private read(): ZunoPersistedServerState {
		try {
			const state = JSON.parse(readFileSync(this.filePath, "utf8"));
			state.idempotency ??= {};
			return state;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return createEmptyPersistedServerState();
			}
			throw error;
		}
	}

	private write(state: ZunoPersistedServerState): void {
		const temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
		try {
			writeFileSync(temporaryPath, JSON.stringify(state), "utf8");
			renameSync(temporaryPath, this.filePath);
		} finally {
			rmSync(temporaryPath, { force: true });
		}
	}

	private withLock<T>(operation: () => T): T {
		const startedAt = Date.now();
		while (true) {
			try {
				mkdirSync(this.lockPath);
				break;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				try {
					if (
						Date.now() - statSync(this.lockPath).mtimeMs >=
						this.staleLockMs
					) {
						rmSync(this.lockPath, { recursive: true, force: true });
						continue;
					}
				} catch (lockError) {
					if ((lockError as NodeJS.ErrnoException).code === "ENOENT") continue;
					throw lockError;
				}
				if (Date.now() - startedAt >= this.lockTimeoutMs) {
					throw new Error(`Timed out acquiring Zuno lock: ${this.lockPath}`);
				}
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
			}
		}
		try {
			return operation();
		} finally {
			rmSync(this.lockPath, { recursive: true, force: true });
		}
	}

	load(): ZunoPersistedServerState {
		return structuredClone(this.read());
	}

	getRecord(storeKey: string): UniverseRecord | undefined {
		const record = this.read().universe[storeKey];
		return record ? structuredClone(record) : undefined;
	}

	getSnapshot(
		partition?: string,
		topics?: ReadonlySet<string>,
	): Record<string, UniverseRecord> {
		const snapshot: Record<string, UniverseRecord> = {};
		for (const [key, record] of Object.entries(this.read().universe)) {
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
		return this.read()
			.events.filter((event) => {
				if ((event.eventId ?? 0) <= query.afterEventId) return false;
				const [partition, topic] = event.storeKey.split(":");
				return (
					(!query.partition || partition === query.partition) &&
					(!query.topics || query.topics.has(topic))
				);
			})
			.slice(0, query.limit);
	}

	getReplayBounds(): ZunoReplayBounds {
		const events = this.read().events;
		return {
			firstEventId: events[0]?.eventId,
			lastEventId: events.at(-1)?.eventId ?? 0,
		};
	}

	appendEvent(event: ZunoStateEvent, maxEvents: number): ZunoStateEvent {
		return this.withLock(() => {
			const state = this.read();
			const authoritative = {
				...structuredClone(event),
				eventId: state.nextEventId++,
				ts: event.ts ?? Date.now(),
			};
			state.events.push(authoritative);
			state.events = state.events.slice(-maxEvents);
			this.write(state);
			return authoritative;
		});
	}

	compact(policy: ZunoCompactionPolicy, now = Date.now()): number {
		return this.withLock(() => {
			const state = this.read();
			const before = state.events.length;
			state.events = state.events
				.filter((event) => {
					const retention =
						event.operation === "delete"
							? policy.tombstoneRetentionMs
							: policy.retentionMs;
					return (
						retention === undefined || now - (event.ts ?? now) <= retention
					);
				})
				.slice(-policy.maxEvents);
			this.write(state);
			return before - state.events.length;
		});
	}

	clear(): void {
		this.save(createEmptyPersistedServerState());
	}

	save(state: ZunoPersistedServerState): void {
		this.withLock(() => this.write(structuredClone(state)));
	}

	compareAndSet(
		event: ZunoStateEvent,
		maxEvents: number,
	): ZunoCompareAndSetResult {
		return this.withLock(() => {
			const state = this.read();
			const result = applyCompareAndSet(state, event, maxEvents);
			if (result.ok) this.write(state);
			return result;
		});
	}
}

export const createFileZunoServerPersistence = (
	filePath: string,
	options?: FileZunoServerPersistenceOptions,
) => new FileZunoServerPersistence(filePath, options);
