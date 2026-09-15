import type { ZunoStateEvent } from "../sync";
import type { UniverseRecord } from "./core";
import type { ZunoAsyncServerPersistence } from "./async-persistence";
import type {
	ZunoCompactionPolicy,
	ZunoCompareAndSetResult,
	ZunoReplayBounds,
	ZunoReplayQuery,
} from "./persistence";

export type ZunoPostgresQueryResult<Row = Record<string, unknown>> = {
	rows: Row[];
	rowCount?: number | null;
};

export interface ZunoPostgresQueryable {
	query<Row = Record<string, unknown>>(
		text: string,
		values?: readonly unknown[],
	): Promise<ZunoPostgresQueryResult<Row>>;
}

export interface ZunoPostgresClient extends ZunoPostgresQueryable {
	release?(): void;
}

export interface ZunoPostgresPool extends ZunoPostgresQueryable {
	connect(): Promise<ZunoPostgresClient>;
	end?(): Promise<void>;
}

export type ZunoPostgresPersistenceOptions = {
	pool: ZunoPostgresPool;
	tablePrefix?: string;
};

type StateRow = { store_key: string; state: unknown; version: number };
type EventRow = {
	event_id: string | number;
	store_key: string;
	state: unknown;
	idempotency_key: string | null;
	durability: "durable" | "ephemeral" | null;
	operation: "upsert" | "delete" | null;
	intent: unknown;
	version: number | null;
	base_version: number | null;
	origin: string | null;
	ts: string | number | null;
};

const safePrefix = (value: string) => {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
		throw new Error("PostgreSQL tablePrefix must be a valid SQL identifier");
	}
	return value;
};

const partitionOf = (storeKey: string) => storeKey.split(":", 1)[0] ?? "";
const topicOf = (storeKey: string) => storeKey.split(":")[1] ?? "";
const toEvent = (row: EventRow): ZunoStateEvent => ({
	storeKey: row.store_key,
	state: row.state,
	idempotencyKey: row.idempotency_key ?? undefined,
	durability: row.durability ?? undefined,
	operation: row.operation ?? undefined,
	intent: row.intent as ZunoStateEvent["intent"],
	version: row.version ?? undefined,
	baseVersion: row.base_version ?? undefined,
	origin: row.origin ?? undefined,
	ts: row.ts == null ? undefined : Number(row.ts),
	eventId: Number(row.event_id),
});

/** PostgreSQL-backed durable authority. The caller owns the supplied pool. */
export class PostgresZunoServerPersistence implements ZunoAsyncServerPersistence {
	private readonly pool: ZunoPostgresPool;
	private readonly states: string;
	private readonly events: string;

	constructor(options: ZunoPostgresPersistenceOptions) {
		this.pool = options.pool;
		const prefix = safePrefix(options.tablePrefix ?? "zuno");
		this.states = `${prefix}_states`;
		this.events = `${prefix}_events`;
	}

	async initialize(): Promise<void> {
		await this.pool.query(`CREATE TABLE IF NOT EXISTS ${this.states} (
			store_key TEXT PRIMARY KEY,
			partition_key TEXT NOT NULL,
			topic TEXT NOT NULL,
			state JSONB,
			version BIGINT NOT NULL CHECK (version >= 0)
		)`);
		await this.pool.query(`CREATE TABLE IF NOT EXISTS ${this.events} (
			event_id BIGSERIAL PRIMARY KEY,
			store_key TEXT NOT NULL,
			partition_key TEXT NOT NULL,
			topic TEXT NOT NULL,
			state JSONB,
			idempotency_key TEXT,
			durability TEXT NOT NULL DEFAULT 'durable',
			operation TEXT NOT NULL DEFAULT 'upsert',
			intent JSONB,
			version BIGINT,
			base_version BIGINT,
			origin TEXT,
			ts BIGINT NOT NULL,
			UNIQUE (partition_key, idempotency_key)
		)`);
		await this.pool.query(
			`CREATE INDEX IF NOT EXISTS ${this.events}_store_event_idx ON ${this.events} (store_key, event_id)`,
		);
	}

	async close(): Promise<void> {
		await this.pool.end?.();
	}

	async getRecord(storeKey: string): Promise<UniverseRecord | undefined> {
		const result = await this.pool.query<StateRow>(
			`SELECT store_key, state, version FROM ${this.states} WHERE store_key = $1`,
			[storeKey],
		);
		const row = result.rows[0];
		return row ? { state: row.state, version: Number(row.version) } : undefined;
	}

	async getSnapshot(partition?: string, topics?: ReadonlySet<string>): Promise<Record<string, UniverseRecord>> {
		const result = await this.pool.query<StateRow>(
			`SELECT store_key, state, version FROM ${this.states}`,
		);
		const snapshot: Record<string, UniverseRecord> = {};
		for (const row of result.rows) {
			if (partition && partitionOf(row.store_key) !== partition) continue;
			if (topics && !topics.has(topicOf(row.store_key))) continue;
			snapshot[row.store_key] = { state: row.state, version: Number(row.version) };
		}
		return snapshot;
	}

	async readEvents(query: ZunoReplayQuery): Promise<ZunoStateEvent[]> {
		const result = await this.pool.query<EventRow>(
			`SELECT * FROM ${this.events} WHERE event_id > $1 ORDER BY event_id ASC`,
			[query.afterEventId],
		);
		return result.rows
			.map(toEvent)
			.filter((event) => (!query.partition || partitionOf(event.storeKey) === query.partition) && (!query.topics || query.topics.has(topicOf(event.storeKey))))
			.slice(0, query.limit);
	}

	async getReplayBounds(): Promise<ZunoReplayBounds> {
		const result = await this.pool.query<{ first_event_id: string | number | null; last_event_id: string | number | null }>(
			`SELECT MIN(event_id) AS first_event_id, MAX(event_id) AS last_event_id FROM ${this.events}`,
		);
		const row = result.rows[0];
		return {
			firstEventId: row?.first_event_id == null ? undefined : Number(row.first_event_id),
			lastEventId: row?.last_event_id == null ? 0 : Number(row.last_event_id),
		};
	}

	async appendEvent(event: ZunoStateEvent, maxEvents: number): Promise<ZunoStateEvent> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const authoritative = await this.insertEvent(client, event);
			await this.trimEvents(client, maxEvents);
			await client.query("COMMIT");
			return authoritative;
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release?.();
		}
	}

	async compareAndSet(event: ZunoStateEvent, maxEvents: number): Promise<ZunoCompareAndSetResult> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const partition = partitionOf(event.storeKey);
			if (event.idempotencyKey) {
				const duplicate = await client.query<EventRow>(
					`SELECT * FROM ${this.events} WHERE partition_key = $1 AND idempotency_key = $2 LIMIT 1`,
					[partition, event.idempotencyKey],
				);
				if (duplicate.rows[0]) {
					await client.query("COMMIT");
					return { ok: true, event: toEvent(duplicate.rows[0]), duplicate: true };
				}
			}

			const locked = await client.query<StateRow>(
				`SELECT store_key, state, version FROM ${this.states} WHERE store_key = $1 FOR UPDATE`,
				[event.storeKey],
			);
			const current: UniverseRecord = locked.rows[0]
				? { state: locked.rows[0].state, version: Number(locked.rows[0].version) }
				: { state: undefined, version: 0 };
			if (typeof event.baseVersion === "number" && event.baseVersion !== current.version) {
				await client.query("ROLLBACK");
				return { ok: false, current };
			}

			const version = current.version + 1;
			if ((event.operation ?? "upsert") === "delete") {
				await client.query(`DELETE FROM ${this.states} WHERE store_key = $1`, [event.storeKey]);
			} else {
				await client.query(
					`INSERT INTO ${this.states} (store_key, partition_key, topic, state, version)
					 VALUES ($1, $2, $3, $4, $5)
					 ON CONFLICT (store_key) DO UPDATE SET state = EXCLUDED.state, version = EXCLUDED.version`,
					[event.storeKey, partition, topicOf(event.storeKey), event.state ?? null, version],
				);
			}
			const authoritative = await this.insertEvent(client, { ...event, durability: "durable", operation: event.operation ?? "upsert", version });
			await this.trimEvents(client, maxEvents);
			await client.query("COMMIT");
			return { ok: true, event: authoritative };
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release?.();
		}
	}

	async compact(policy: ZunoCompactionPolicy, now = Date.now()): Promise<number> {
		const before = await this.getReplayBounds();
		if (policy.retentionMs != null) {
			await this.pool.query(`DELETE FROM ${this.events} WHERE ts < $1`, [now - policy.retentionMs]);
		}
		await this.pool.query(
			`DELETE FROM ${this.events} WHERE event_id NOT IN (SELECT event_id FROM ${this.events} ORDER BY event_id DESC LIMIT $1)`,
			[Math.max(0, policy.maxEvents)],
		);
		const after = await this.getReplayBounds();
		const beforeCount = before.lastEventId - (before.firstEventId ?? before.lastEventId) + (before.firstEventId ? 1 : 0);
		const afterCount = after.lastEventId - (after.firstEventId ?? after.lastEventId) + (after.firstEventId ? 1 : 0);
		return Math.max(0, beforeCount - afterCount);
	}

	async clear(): Promise<void> {
		await this.pool.query(`TRUNCATE TABLE ${this.events}, ${this.states} RESTART IDENTITY`);
	}

	private async insertEvent(client: ZunoPostgresQueryable, event: ZunoStateEvent): Promise<ZunoStateEvent> {
		const result = await client.query<EventRow>(
			`INSERT INTO ${this.events} (store_key, partition_key, topic, state, idempotency_key, durability, operation, intent, version, base_version, origin, ts)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
			[event.storeKey, partitionOf(event.storeKey), topicOf(event.storeKey), event.state ?? null, event.idempotencyKey ?? null, event.durability ?? "durable", event.operation ?? "upsert", event.intent ?? null, event.version ?? null, event.baseVersion ?? null, event.origin ?? null, event.ts ?? Date.now()],
		);
		const row = result.rows[0];
		if (!row) throw new Error("PostgreSQL did not return the inserted Zuno event");
		return toEvent(row);
	}

	private async trimEvents(client: ZunoPostgresQueryable, maxEvents: number): Promise<void> {
		await client.query(
			`DELETE FROM ${this.events} WHERE event_id NOT IN (SELECT event_id FROM ${this.events} ORDER BY event_id DESC LIMIT $1)`,
			[Math.max(0, maxEvents)],
		);
	}
}
