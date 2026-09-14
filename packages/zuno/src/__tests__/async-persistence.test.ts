import { describe, expect, it } from "vitest";
import {
	asAsyncZunoServerPersistence,
	createAsyncZunoServerState,
	createMemoryZunoServerPersistence,
} from "../server";

describe("async persistence compatibility", () => {
	it("lifts the synchronous persistence contract without changing CAS semantics", async () => {
		const sync = createMemoryZunoServerPersistence();
		const persistence = asAsyncZunoServerPersistence(sync);
		const server = createAsyncZunoServerState({ persistence, maxEvents: 100 });

		const first = await server.compareAndSet({
			storeKey: "tenant:cart:1",
			state: { quantity: 1 },
			baseVersion: 0,
			idempotencyKey: "mutation-1",
		});
		expect(first.ok).toBe(true);
		if (!first.ok) throw new Error("expected first mutation to succeed");
		expect(first.event.version).toBe(1);

		const duplicate = await server.compareAndSet({
			storeKey: "tenant:cart:1",
			state: { quantity: 999 },
			baseVersion: 0,
			idempotencyKey: "mutation-1",
		});
		expect(duplicate.ok).toBe(true);
		if (!duplicate.ok) throw new Error("expected duplicate to resolve");
		expect(duplicate.duplicate).toBe(true);
		expect(duplicate.event.eventId).toBe(first.event.eventId);

		const stale = await server.compareAndSet({
			storeKey: "tenant:cart:1",
			state: { quantity: 2 },
			baseVersion: 0,
		});
		expect(stale.ok).toBe(false);
		if (stale.ok) throw new Error("expected stale mutation to conflict");
		expect(stale.current.version).toBe(1);

		expect(await server.getUniverseRecord("tenant:cart:1")).toEqual({
			state: { quantity: 1 },
			version: 1,
		});
		expect((await server.getEventsAfter(0)).length).toBe(1);
		expect(await server.getLastEventId()).toBe(first.event.eventId);
		expect(await server.canReplayAfter(0)).toBe(true);
	});

	it("leaves the original synchronous implementation synchronous", () => {
		const persistence = createMemoryZunoServerPersistence();
		const result = persistence.compareAndSet(
			{ storeKey: "tenant:cart:1", state: { quantity: 1 }, baseVersion: 0 },
			100,
		);

		expect(result).not.toBeInstanceOf(Promise);
		expect(result.ok).toBe(true);
		expect(persistence.getRecord("tenant:cart:1")?.version).toBe(1);
	});
});
