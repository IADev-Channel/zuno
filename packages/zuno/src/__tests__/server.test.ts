import { describe, expect, it, vi } from "vitest";
import {
	applyStateEvent,
	createZunoServerRegistry,
	createZunoServerState,
	validateStateEvent,
} from "../server";

describe("Zuno server state", () => {
	it("isolates state, event logs, and listeners between instances", () => {
		const serverA = createZunoServerState();
		const serverB = createZunoServerState();
		const listenerA = vi.fn();
		const listenerB = vi.fn();
		serverA.subscribeToStateEvents(listenerA);
		serverB.subscribeToStateEvents(listenerB);

		const result = applyStateEvent(
			{ storeKey: "counter", state: 1, baseVersion: 0 },
			serverA,
		);

		expect(result.ok).toBe(true);
		expect(serverA.getUniverseState()).toEqual({
			counter: { state: 1, version: 1 },
		});
		expect(serverA.getLastEventId()).toBe(1);
		expect(listenerA).toHaveBeenCalledOnce();
		expect(serverB.getUniverseState()).toEqual({});
		expect(serverB.getLastEventId()).toBe(0);
		expect(listenerB).not.toHaveBeenCalled();
	});

	it("rejects malformed events without mutating state", () => {
		const server = createZunoServerState();
		const result = applyStateEvent(
			{ storeKey: "", state: Symbol("invalid"), baseVersion: -1 },
			server,
		);

		expect(result).toMatchObject({ ok: false, reason: "INVALID_EVENT" });
		expect(server.getUniverseState()).toEqual({});
		expect(server.getLastEventId()).toBe(0);
	});

	it("reports every invalid field in one validation result", () => {
		const errors = validateStateEvent({
			storeKey: " ",
			baseVersion: 1.5,
			origin: 42,
			ts: Number.POSITIVE_INFINITY,
			intent: { type: "" },
		});

		expect(errors.map((error) => error.field)).toEqual([
			"storeKey",
			"state",
			"baseVersion",
			"origin",
			"ts",
			"intent",
		]);
	});

	it("enforces the configured replay-log limit", () => {
		const server = createZunoServerState({ maxEvents: 2 });
		applyStateEvent({ storeKey: "counter", state: 1 }, server);
		applyStateEvent({ storeKey: "counter", state: 2 }, server);
		applyStateEvent({ storeKey: "counter", state: 3 }, server);

		expect(server.getEventsAfter(0).map((event) => event.eventId)).toEqual([
			2, 3,
		]);
	});

	it("rejects state above the configured serialized size limit", () => {
		const server = createZunoServerState({ maxStateBytes: 10 });
		const result = applyStateEvent(
			{ storeKey: "large", state: "a payload larger than ten bytes" },
			server,
		);

		expect(result).toMatchObject({ ok: false, reason: "INVALID_EVENT" });
		expect(server.getUniverseState()).toEqual({});
	});

	it("creates stable, isolated namespace instances", () => {
		const registry = createZunoServerRegistry();
		const tenantA = registry.get("tenant-a");
		const tenantB = registry.get("tenant-b");
		applyStateEvent({ storeKey: "counter", state: 1 }, tenantA);

		expect(registry.get("tenant-a")).toBe(tenantA);
		expect(tenantA.getUniverseState()).toHaveProperty("counter");
		expect(tenantB.getUniverseState()).toEqual({});
	});
});
