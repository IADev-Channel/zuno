import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { parseScopedStoreKey, type ZunoStateEvent } from "../sync";
import type { UniverseRecord } from "./core";
import {
	createEmptyPersistedServerState,
	type ZunoCompactionPolicy,
	type ZunoCompareAndSetResult,
	type ZunoPersistedServerState,
	type ZunoReplayBounds,
	type ZunoReplayQuery,
	type ZunoServerPersistence,
} from "./persistence";

type Row = Record<string, unknown>;
const { DatabaseSync } = createRequire(`${process.cwd()}/`)(
	"node:sqlite",
) as typeof import("node:sqlite");
export type SQLiteZunoFailureStage = "after-state-write" | "before-commit";
export type SQLiteZunoServerPersistenceOptions = {
	failureInjector?: (stage: SQLiteZunoFailureStage) => void;
};

const decodeEvent = (row: Row): ZunoStateEvent =>
	JSON.parse(String(row.payload_json)) as ZunoStateEvent;

/** SQLite-backed production authority with database transactions and constraints. */
export class SQLiteZunoServerPersistence implements ZunoServerPersistence {
	private readonly database: DatabaseSyncType;

	constructor(
		path: string,
		private readonly options: SQLiteZunoServerPersistenceOptions = {},
	) {
		if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
		this.database = new DatabaseSync(path);
		this.database.exec(
			"PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
		);
		this.database.exec(`
			CREATE TABLE IF NOT EXISTS zuno_state (
				partition_key TEXT NOT NULL,
				store_key TEXT NOT NULL,
				state_json TEXT NOT NULL,
				version INTEGER NOT NULL CHECK(version > 0),
				PRIMARY KEY(partition_key, store_key)
			);
			CREATE TABLE IF NOT EXISTS zuno_events (
				event_id INTEGER PRIMARY KEY AUTOINCREMENT,
				partition_key TEXT NOT NULL,
				topic TEXT NOT NULL,
				store_key TEXT NOT NULL,
				operation TEXT NOT NULL CHECK(operation IN ('upsert', 'delete')),
				created_at INTEGER NOT NULL,
				payload_json TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS zuno_events_scope ON zuno_events(partition_key, topic, event_id);
			CREATE TABLE IF NOT EXISTS zuno_idempotency (
				partition_key TEXT NOT NULL,
				idempotency_key TEXT NOT NULL,
				event_id INTEGER NOT NULL REFERENCES zuno_events(event_id) ON DELETE CASCADE,
				PRIMARY KEY(partition_key, idempotency_key)
			);
		`);
	}

	getRecord(storeKey: string): UniverseRecord | undefined {
		const scope = parseScopedStoreKey(storeKey);
		const row = this.database
			.prepare(
				"SELECT state_json, version FROM zuno_state WHERE partition_key = ? AND store_key = ?",
			)
			.get(scope?.partition ?? "", storeKey) as Row | undefined;
		return row
			? {
					state: JSON.parse(String(row.state_json)),
					version: Number(row.version),
				}
			: undefined;
	}

	getSnapshot(
		partition?: string,
		topics?: ReadonlySet<string>,
	): Record<string, UniverseRecord> {
		const rows = (
			partition
				? this.database
						.prepare(
							"SELECT store_key, state_json, version FROM zuno_state WHERE partition_key = ?",
						)
						.all(partition)
				: this.database
						.prepare("SELECT store_key, state_json, version FROM zuno_state")
						.all()
		) as Row[];
		const snapshot: Record<string, UniverseRecord> = {};
		for (const row of rows) {
			const key = String(row.store_key);
			const scope = parseScopedStoreKey(key);
			if (topics && (!scope || !topics.has(scope.topic))) continue;
			snapshot[key] = {
				state: JSON.parse(String(row.state_json)),
				version: Number(row.version),
			};
		}
		return snapshot;
	}

	compareAndSet(
		event: ZunoStateEvent,
		maxEvents: number,
	): ZunoCompareAndSetResult {
		const scope = parseScopedStoreKey(event.storeKey);
		const partition = scope?.partition ?? "";
		const topic = scope?.topic ?? "";
		this.database.exec("BEGIN IMMEDIATE");
		try {
			if (event.idempotencyKey) {
				const duplicate = this.database
					.prepare(
						`SELECT e.payload_json FROM zuno_idempotency i JOIN zuno_events e ON e.event_id = i.event_id WHERE i.partition_key = ? AND i.idempotency_key = ?`,
					)
					.get(partition, event.idempotencyKey) as Row | undefined;
				if (duplicate) {
					this.database.exec("COMMIT");
					return { ok: true, event: decodeEvent(duplicate), duplicate: true };
				}
			}
			const current = this.getRecord(event.storeKey) ?? {
				state: undefined,
				version: 0,
			};
			if (
				event.baseVersion !== undefined &&
				event.baseVersion !== current.version
			) {
				this.database.exec("ROLLBACK");
				return { ok: false, current };
			}
			const version = current.version + 1;
			const operation = event.operation ?? "upsert";
			const createdAt = event.ts ?? Date.now();
			if (operation === "delete") {
				this.database
					.prepare(
						"DELETE FROM zuno_state WHERE partition_key = ? AND store_key = ?",
					)
					.run(partition, event.storeKey);
			} else {
				this.database
					.prepare(
						`INSERT INTO zuno_state(partition_key, store_key, state_json, version) VALUES (?, ?, ?, ?) ON CONFLICT(partition_key, store_key) DO UPDATE SET state_json = excluded.state_json, version = excluded.version WHERE zuno_state.version = ?`,
					)
					.run(
						partition,
						event.storeKey,
						JSON.stringify(event.state),
						version,
						current.version,
					);
			}
			this.options.failureInjector?.("after-state-write");
			const provisional = {
				...event,
				durability: "durable" as const,
				operation,
				version,
				ts: createdAt,
			};
			const inserted = this.database
				.prepare(
					"INSERT INTO zuno_events(partition_key, topic, store_key, operation, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.run(partition, topic, event.storeKey, operation, createdAt, "{}");
			const authoritative = {
				...provisional,
				eventId: Number(inserted.lastInsertRowid),
			};
			this.database
				.prepare("UPDATE zuno_events SET payload_json = ? WHERE event_id = ?")
				.run(JSON.stringify(authoritative), authoritative.eventId ?? 0);
			if (event.idempotencyKey)
				this.database
					.prepare(
						"INSERT INTO zuno_idempotency(partition_key, idempotency_key, event_id) VALUES (?, ?, ?)",
					)
					.run(partition, event.idempotencyKey, authoritative.eventId ?? 0);
			this.compactInTransaction({ maxEvents });
			this.options.failureInjector?.("before-commit");
			this.database.exec("COMMIT");
			return { ok: true, event: authoritative };
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	readEvents(query: ZunoReplayQuery): ZunoStateEvent[] {
		const clauses = ["event_id > ?"];
		const values: Array<string | number> = [query.afterEventId];
		if (query.partition) {
			clauses.push("partition_key = ?");
			values.push(query.partition);
		}
		if (query.topics?.size) {
			clauses.push(`topic IN (${[...query.topics].map(() => "?").join(",")})`);
			values.push(...query.topics);
		}
		values.push(query.limit ?? Number.MAX_SAFE_INTEGER);
		const rows = this.database
			.prepare(
				`SELECT payload_json FROM zuno_events WHERE ${clauses.join(" AND ")} ORDER BY event_id LIMIT ?`,
			)
			.all(...values) as Row[];
		return rows.map(decodeEvent);
	}

	getReplayBounds(): ZunoReplayBounds {
		const row = this.database
			.prepare(
				"SELECT MIN(event_id) first_event_id, MAX(event_id) last_event_id FROM zuno_events",
			)
			.get() as Row;
		return {
			firstEventId:
				row.first_event_id == null ? undefined : Number(row.first_event_id),
			lastEventId: Number(row.last_event_id ?? 0),
		};
	}

	appendEvent(event: ZunoStateEvent, maxEvents: number): ZunoStateEvent {
		const scope = parseScopedStoreKey(event.storeKey);
		const operation = event.operation ?? "upsert";
		const createdAt = event.ts ?? Date.now();
		this.database.exec("BEGIN IMMEDIATE");
		try {
			const inserted = this.database
				.prepare(
					"INSERT INTO zuno_events(partition_key, topic, store_key, operation, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.run(
					scope?.partition ?? "",
					scope?.topic ?? "",
					event.storeKey,
					operation,
					createdAt,
					"{}",
				);
			const authoritative = {
				...event,
				operation,
				ts: createdAt,
				eventId: Number(inserted.lastInsertRowid),
			};
			this.database
				.prepare("UPDATE zuno_events SET payload_json = ? WHERE event_id = ?")
				.run(JSON.stringify(authoritative), authoritative.eventId);
			this.compactInTransaction({ maxEvents });
			this.database.exec("COMMIT");
			return authoritative;
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	private compactInTransaction(
		policy: ZunoCompactionPolicy,
		now = Date.now(),
	): number {
		const before = Number(
			(
				this.database
					.prepare("SELECT COUNT(*) count FROM zuno_events")
					.get() as Row
			).count,
		);
		if (policy.retentionMs !== undefined)
			this.database
				.prepare(
					"DELETE FROM zuno_events WHERE operation = 'upsert' AND created_at < ?",
				)
				.run(now - policy.retentionMs);
		if (policy.tombstoneRetentionMs !== undefined)
			this.database
				.prepare(
					"DELETE FROM zuno_events WHERE operation = 'delete' AND created_at < ?",
				)
				.run(now - policy.tombstoneRetentionMs);
		this.database
			.prepare(
				"DELETE FROM zuno_events WHERE event_id NOT IN (SELECT event_id FROM zuno_events ORDER BY event_id DESC LIMIT ?)",
			)
			.run(policy.maxEvents);
		const after = Number(
			(
				this.database
					.prepare("SELECT COUNT(*) count FROM zuno_events")
					.get() as Row
			).count,
		);
		return before - after;
	}

	compact(policy: ZunoCompactionPolicy, now = Date.now()): number {
		this.database.exec("BEGIN IMMEDIATE");
		try {
			const removed = this.compactInTransaction(policy, now);
			this.database.exec("COMMIT");
			return removed;
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	clear(): void {
		this.database.exec(
			"BEGIN IMMEDIATE; DELETE FROM zuno_idempotency; DELETE FROM zuno_events; DELETE FROM zuno_state; COMMIT;",
		);
	}

	load(): ZunoPersistedServerState {
		const state = createEmptyPersistedServerState();
		state.universe = this.getSnapshot();
		state.events = this.readEvents({ afterEventId: 0 });
		state.nextEventId = this.getReplayBounds().lastEventId + 1;
		return state;
	}

	save(state: ZunoPersistedServerState): void {
		this.clear();
		for (const event of state.events)
			this.compareAndSet(
				{ ...event, baseVersion: undefined },
				Math.max(1, state.events.length),
			);
	}

	close(): void {
		this.database.close();
	}
}

export const createSQLiteZunoServerPersistence = (
	path: string,
	options?: SQLiteZunoServerPersistenceOptions,
) => new SQLiteZunoServerPersistence(path, options);
