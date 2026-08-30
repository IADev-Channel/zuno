import { EventEmitter } from "node:events";
import { mkdirSync, readFileSync, rmSync, utimesSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	applyStateEvent,
	createFileZunoServerPersistence,
	createMemoryZunoServerEventBus,
	createMemoryZunoServerPersistence,
	createSSEConnection,
	createZunoServerRegistry,
	createZunoServerState,
	validateStateEvent,
} from "../server";

const createSSEMocks = (
	lastEventId: number,
	write: (chunk: string) => boolean = () => true,
) => {
	const request = Object.assign(new EventEmitter(), {
		headers: { "last-event-id": String(lastEventId) },
		url: "/sync",
	});
	const response = Object.assign(new EventEmitter(), {
		writeHead: vi.fn(),
		flushHeaders: vi.fn(),
		write: vi.fn(write),
		end: vi.fn(),
	});
	return {
		request: request as unknown as IncomingMessage,
		response: response as unknown as ServerResponse,
		requestEmitter: request,
		responseMock: response,
	};
};

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
		expect(server.canReplayAfter(0)).toBe(false);
		expect(server.canReplayAfter(1)).toBe(true);
		expect(server.canReplayAfter(3)).toBe(true);
		expect(server.canReplayAfter(4)).toBe(false);
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

	it("falls back to an authoritative snapshot when replay was truncated", () => {
		const server = createZunoServerState({ maxEvents: 2 });
		for (let state = 1; state <= 4; state++) {
			applyStateEvent({ storeKey: "counter", state }, server);
		}
		const { request, response, requestEmitter, responseMock } =
			createSSEMocks(1);

		createSSEConnection(request, response, {}, server);

		const output = responseMock.write.mock.calls.flat().join("");
		expect(output).toContain("id: 4\nevent: snapshot");
		expect(output).toContain('"counter":{"state":4,"version":4}');
		requestEmitter.emit("close");
	});

	it("sends a fresh snapshot after an in-memory server process restart", () => {
		const restartedServer = createZunoServerState();
		const { request, response, requestEmitter, responseMock } =
			createSSEMocks(12);

		createSSEConnection(request, response, {}, restartedServer);

		const output = responseMock.write.mock.calls.flat().join("");
		expect(output).toContain("id: 0\nevent: snapshot\ndata: {}");
		requestEmitter.emit("close");
	});

	it("disconnects a slow subscriber when its pending buffer is full", () => {
		const server = createZunoServerState({ maxSubscriberBuffer: 1 });
		const { request, response, responseMock } = createSSEMocks(
			0,
			(chunk) => !chunk.includes("event: state"),
		);
		createSSEConnection(request, response, {}, server);

		applyStateEvent({ storeKey: "counter", state: 1 }, server);
		applyStateEvent({ storeKey: "counter", state: 2 }, server);
		applyStateEvent({ storeKey: "counter", state: 3 }, server);

		expect(responseMock.end).toHaveBeenCalledOnce();
	});

	it("removes the server listener when the SSE request closes", () => {
		const server = createZunoServerState();
		const { request, response, requestEmitter, responseMock } =
			createSSEMocks(0);
		createSSEConnection(request, response, {}, server);
		const writesBeforeClose = responseMock.write.mock.calls.length;

		requestEmitter.emit("close");
		applyStateEvent({ storeKey: "counter", state: 1 }, server);

		expect(responseMock.write).toHaveBeenCalledTimes(writesBeforeClose);
		expect(responseMock.end).toHaveBeenCalledOnce();
	});

	it("restores authoritative state and replay events from durable storage", () => {
		const directory = join(tmpdir(), `zuno-restart-${crypto.randomUUID()}`);
		const filePath = join(directory, "server.json");
		try {
			const firstServer = createZunoServerState({
				persistence: createFileZunoServerPersistence(filePath),
			});
			applyStateEvent(
				{ storeKey: "counter", state: 1, baseVersion: 0 },
				firstServer,
			);
			applyStateEvent(
				{ storeKey: "counter", state: 2, baseVersion: 1 },
				firstServer,
			);

			const restartedServer = createZunoServerState({
				persistence: createFileZunoServerPersistence(filePath),
			});

			expect(restartedServer.getUniverseRecord("counter")).toEqual({
				state: 2,
				version: 2,
			});
			expect(
				restartedServer.getEventsAfter(0).map((event) => event.eventId),
			).toEqual([1, 2]);
			expect(restartedServer.canReplayAfter(1)).toBe(true);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("leaves durable storage unchanged after a compare-and-set conflict", () => {
		const directory = join(tmpdir(), `zuno-conflict-${crypto.randomUUID()}`);
		const filePath = join(directory, "server.json");
		try {
			const server = createZunoServerState({
				persistence: createFileZunoServerPersistence(filePath),
			});
			applyStateEvent(
				{ storeKey: "counter", state: 1, baseVersion: 0 },
				server,
			);
			const beforeConflict = readFileSync(filePath, "utf8");

			const result = applyStateEvent(
				{ storeKey: "counter", state: 99, baseVersion: 0 },
				server,
			);

			expect(result).toMatchObject({
				ok: false,
				reason: "VERSION_CONFLICT",
			});
			expect(readFileSync(filePath, "utf8")).toBe(beforeConflict);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("recovers from a lock abandoned by a crashed process", () => {
		const directory = join(tmpdir(), `zuno-stale-lock-${crypto.randomUUID()}`);
		const filePath = join(directory, "server.json");
		try {
			const persistence = createFileZunoServerPersistence(filePath, {
				staleLockMs: 10,
			});
			mkdirSync(`${filePath}.lock`);
			const staleTime = new Date(Date.now() - 1000);
			utimesSync(`${filePath}.lock`, staleTime, staleTime);
			const server = createZunoServerState({ persistence });

			const result = applyStateEvent(
				{ storeKey: "counter", state: 1, baseVersion: 0 },
				server,
			);

			expect(result.ok).toBe(true);
			expect(server.getLastEventId()).toBe(1);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("preserves conflict semantics across server instances sharing authority", () => {
		const persistence = createMemoryZunoServerPersistence();
		const eventBus = createMemoryZunoServerEventBus();
		const serverA = createZunoServerState({
			persistence,
			eventBus,
			instanceId: "server-a",
		});
		const serverB = createZunoServerState({
			persistence,
			eventBus,
			instanceId: "server-b",
		});
		const listenerA = vi.fn();
		const listenerB = vi.fn();
		serverA.subscribeToStateEvents(listenerA);
		serverB.subscribeToStateEvents(listenerB);

		const accepted = applyStateEvent(
			{ storeKey: "counter", state: "from-a", baseVersion: 0 },
			serverA,
		);
		const rejected = applyStateEvent(
			{ storeKey: "counter", state: "from-b", baseVersion: 0 },
			serverB,
		);

		expect(accepted.ok).toBe(true);
		expect(rejected).toMatchObject({
			ok: false,
			reason: "VERSION_CONFLICT",
			current: { state: "from-a", version: 1 },
		});
		expect(serverA.getUniverseState()).toEqual(serverB.getUniverseState());
		expect(listenerA).toHaveBeenCalledOnce();
		expect(listenerB).toHaveBeenCalledOnce();

		serverB.dispose();
		applyStateEvent(
			{ storeKey: "counter", state: "from-a-again", baseVersion: 1 },
			serverA,
		);
		expect(listenerB).toHaveBeenCalledOnce();
		serverA.dispose();
	});
});
