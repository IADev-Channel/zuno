import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	applyStateEvent,
	createMemoryZunoServerEventBus,
	createZunoServerState,
} from "../server";
import { createSQLiteZunoServerPersistence } from "../server/sqlite-persistence";

const withDatabase = (run: (path: string) => void) => {
	const path = join(tmpdir(), `zuno-${crypto.randomUUID()}.sqlite`);
	try {
		run(path);
	} finally {
		rmSync(path, { force: true });
		rmSync(`${path}-shm`, { force: true });
		rmSync(`${path}-wal`, { force: true });
	}
};

describe("milestone 10 durable authority", () => {
	it("survives restart with authoritative state and ranged replay", () =>
		withDatabase((path) => {
			const firstPersistence = createSQLiteZunoServerPersistence(path);
			const first = createZunoServerState({ persistence: firstPersistence });
			applyStateEvent(
				{ storeKey: "tenant-a:cart:1", state: { count: 1 }, baseVersion: 0 },
				first,
			);
			applyStateEvent(
				{ storeKey: "tenant-a:cart:1", state: { count: 2 }, baseVersion: 1 },
				first,
			);
			firstPersistence.close();

			const restartedPersistence = createSQLiteZunoServerPersistence(path);
			const restarted = createZunoServerState({
				persistence: restartedPersistence,
			});
			expect(restarted.getUniverseRecord("tenant-a:cart:1")).toEqual({
				state: { count: 2 },
				version: 2,
			});
			expect(
				restarted.getScopedEventsAfter(1, "tenant-a", new Set(["cart"])),
			).toHaveLength(1);
			restartedPersistence.close();
		}));

	it("deduplicates retried mutations atomically within a partition", () =>
		withDatabase((path) => {
			const persistence = createSQLiteZunoServerPersistence(path);
			const server = createZunoServerState({ persistence });
			const event = {
				storeKey: "tenant-a:cart:1",
				state: 1,
				baseVersion: 0,
				idempotencyKey: "batch-1",
			};
			const first = applyStateEvent(event, server);
			const retry = applyStateEvent(event, server);
			expect(first).toMatchObject({ ok: true, duplicate: undefined });
			expect(retry).toMatchObject({ ok: true, duplicate: true });
			expect(server.getEventsAfter(0)).toHaveLength(1);
			expect(server.getUniverseRecord(event.storeKey)?.version).toBe(1);
			persistence.close();
		}));

	it("keeps ephemeral presence out of state and replay", () => {
		const server = createZunoServerState();
		const listener = vi.fn();
		server.subscribeToStateEvents(listener);
		const result = applyStateEvent(
			{
				storeKey: "tenant-a:presence:alice",
				state: { online: true },
				durability: "ephemeral",
			},
			server,
		);
		expect(result.ok).toBe(true);
		expect(listener).toHaveBeenCalledOnce();
		expect(server.getUniverseState()).toEqual({});
		expect(server.getEventsAfter(0)).toEqual([]);
	});

	it("replays tombstones until their distinct retention window expires", () =>
		withDatabase((path) => {
			const persistence = createSQLiteZunoServerPersistence(path);
			const server = createZunoServerState({ persistence, maxEvents: 10 });
			applyStateEvent(
				{ storeKey: "tenant-a:cart:1", state: 1, ts: 100 },
				server,
			);
			applyStateEvent(
				{
					storeKey: "tenant-a:cart:1",
					state: null,
					operation: "delete",
					ts: 200,
				},
				server,
			);
			expect(server.getUniverseRecord("tenant-a:cart:1")).toBeUndefined();
			expect(
				persistence.compact(
					{ maxEvents: 10, retentionMs: 50, tombstoneRetentionMs: 200 },
					300,
				),
			).toBe(1);
			expect(server.getEventsAfter(0)).toHaveLength(1);
			expect(
				persistence.compact({ maxEvents: 10, tombstoneRetentionMs: 200 }, 401),
			).toBe(1);
			persistence.close();
		}));

	it("tracks offsets per partition and ignores duplicate delivery", () => {
		const bus = createMemoryZunoServerEventBus();
		const server = createZunoServerState({
			eventBus: bus,
			instanceId: "consumer",
		});
		const listener = vi.fn();
		server.subscribeToStateEvents(listener);
		const event = { storeKey: "tenant-a:cart:1", state: 1 };
		bus.publish({ source: "producer", event });
		expect(bus.getConsumerOffset("consumer", "tenant-a")).toBe(1);
		bus.commitConsumerOffset("consumer", "tenant-a", 4);
		bus.publish({ source: "producer", event });
		expect(listener).toHaveBeenCalledOnce();
		server.dispose();
	});

	it("recovers from event-bus failure through durable replay", () =>
		withDatabase((path) => {
			const persistence = createSQLiteZunoServerPersistence(path);
			const failingBus = createMemoryZunoServerEventBus();
			failingBus.subscribe(() => {
				throw new Error("injected bus failure");
			});
			const server = createZunoServerState({
				persistence,
				eventBus: failingBus,
				instanceId: "writer",
			});
			expect(() =>
				applyStateEvent(
					{
						storeKey: "tenant-a:cart:1",
						state: 1,
						idempotencyKey: "safe-retry",
					},
					server,
				),
			).toThrow("injected bus failure");
			persistence.close();

			const recoveredPersistence = createSQLiteZunoServerPersistence(path);
			const recovered = createZunoServerState({
				persistence: recoveredPersistence,
			});
			expect(recovered.getUniverseRecord("tenant-a:cart:1")?.state).toBe(1);
			expect(recovered.getEventsAfter(0)).toHaveLength(1);
			expect(
				applyStateEvent(
					{
						storeKey: "tenant-a:cart:1",
						state: 1,
						idempotencyKey: "safe-retry",
					},
					recovered,
				),
			).toMatchObject({ ok: true, duplicate: true });
			recoveredPersistence.close();
		}));

	it("rolls back state and log together after an injected database failure", () =>
		withDatabase((path) => {
			const persistence = createSQLiteZunoServerPersistence(path, {
				failureInjector(stage) {
					if (stage === "after-state-write")
						throw new Error("injected database failure");
				},
			});
			const server = createZunoServerState({ persistence });
			expect(() =>
				applyStateEvent({ storeKey: "tenant-a:cart:1", state: 1 }, server),
			).toThrow("injected database failure");
			expect(server.getUniverseState()).toEqual({});
			expect(server.getEventsAfter(0)).toEqual([]);
			persistence.close();
		}));

	it("benchmark: sustains realistic hot-partition transactional writes", () =>
		withDatabase((path) => {
			const persistence = createSQLiteZunoServerPersistence(path);
			const server = createZunoServerState({ persistence, maxEvents: 2_000 });
			const payload = {
				text: "x".repeat(1024),
				items: Array.from({ length: 10 }, (_, id) => ({ id, done: false })),
			};
			const started = performance.now();
			for (let version = 0; version < 250; version++) {
				const result = applyStateEvent(
					{
						storeKey: "tenant-hot:documents:shared",
						state: { ...payload, version },
						baseVersion: version,
						idempotencyKey: `bench-${version}`,
					},
					server,
				);
				expect(result.ok).toBe(true);
			}
			const duration = performance.now() - started;
			console.info(
				`[Benchmark] SQLite hot partition: 250 x ~1KB writes in ${duration.toFixed(2)}ms`,
			);
			expect(duration).toBeLessThan(10_000);
			persistence.close();
		}));
});
