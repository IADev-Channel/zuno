import { gunzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUniverse, createZuno } from "../core";
import {
	applyStateEvent,
	applyStateEventBatch,
	createZunoConnectionGateway,
	createZunoServerState,
} from "../server";
import {
	applyZunoStateDelta,
	optimizeZunoStateEvent,
	startSSE,
	startWebSocket,
	type ZunoMetric,
} from "../sync";

class PassiveEventSource {
	onopen: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(readonly url: string) {
		PassiveEventSource.instances.push(this);
	}
	static instances: PassiveEventSource[] = [];
	addEventListener() {}
	close() {}
}

describe("milestone 12 traffic and connection efficiency", () => {
	beforeEach(() => {
		PassiveEventSource.instances = [];
		global.EventSource = PassiveEventSource as unknown as typeof EventSource;
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ ok: true, results: [] }),
		});
	});

	it("applies ordered mutation batches through one authority", () => {
		const server = createZunoServerState();
		const result = applyStateEventBatch(
			{
				events: [
					{ storeKey: "tenant:cart:one", state: 1, baseVersion: 0 },
					{ storeKey: "tenant:cart:two", state: 2, baseVersion: 0 },
				],
			},
			server,
		);
		expect(result.ok).toBe(true);
		expect(result.results).toHaveLength(2);
		expect(server.getLastEventId()).toBe(2);
	});

	it("stops a batch at the first conflict", () => {
		const server = createZunoServerState();
		applyStateEvent({ storeKey: "tenant:cart:one", state: 1 }, server);
		const result = applyStateEventBatch(
			{
				events: [
					{ storeKey: "tenant:cart:one", state: 2, baseVersion: 0 },
					{ storeKey: "tenant:cart:two", state: 2 },
				],
			},
			server,
		);
		expect(result).toMatchObject({ ok: false, conflictIndex: 0 });
		expect(server.getUniverseRecord("tenant:cart:two")).toBeUndefined();
	});

	it("uses a compact object delta only when it saves bytes", () => {
		const current = { title: "document", body: "x".repeat(500), revision: 1 };
		const next = { ...current, revision: 2 };
		const optimized = optimizeZunoStateEvent(
			{ storeKey: "tenant:docs:one", state: next, intent: { type: "SET" } },
			current,
		);
		expect(optimized.state).toBeUndefined();
		expect(optimized.intent).toBeUndefined();
		if (!optimized.delta) throw new Error("expected an optimized delta");
		expect(applyZunoStateDelta(current, optimized.delta)).toEqual(next);

		const server = createZunoServerState();
		applyStateEvent({ storeKey: "tenant:docs:one", state: current }, server);
		const applied = applyStateEvent({ ...optimized, baseVersion: 1 }, server);
		expect(applied).toMatchObject({ ok: true, event: { state: next } });
	});

	it("coalesces configured client mutations into one HTTP batch", async () => {
		const zuno = createZuno({
			sseUrl: "http://localhost/events",
			syncUrl: "http://localhost/sync",
			batchSync: { waitMs: 5, maxSize: 10 },
		});
		void zuno.set("one", 1, () => 0);
		void zuno.set("two", 2, () => 0);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(fetch).toHaveBeenCalledTimes(1);
		const request = vi.mocked(fetch).mock.calls[0][1];
		expect(JSON.parse(String(request?.body))).toMatchObject({
			events: [{ storeKey: "one" }, { storeKey: "two" }],
		});
		zuno.stop();
	});

	it("compresses HTTP mutations at the configured threshold", async () => {
		const transport = startSSE({
			universe: createUniverse(),
			url: "http://localhost/events",
			syncUrl: "http://localhost/sync",
			optimistic: false,
			clientId: "compression-client",
			versions: new Map(),
			getLastEventId: () => 0,
			compressionThresholdBytes: 1,
		});
		await transport.dispatch({ storeKey: "large", state: "x".repeat(1000) });
		const request = vi.mocked(fetch).mock.calls[0][1];
		expect(request?.headers).toMatchObject({ "Content-Encoding": "gzip" });
		const decoded = gunzipSync(Buffer.from(request?.body as ArrayBuffer));
		expect(JSON.parse(decoded.toString()).storeKey).toBe("large");
		transport.unsubscribe?.();
	});

	it("elects only one browser SSE owner for a shared connection", async () => {
		const pending: Array<() => Promise<void>> = [];
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: {
				request: vi.fn((_key: string, callback: () => Promise<void>) => {
					pending.push(callback);
					if (pending.length === 1) void callback();
					return Promise.resolve();
				}),
			},
		});
		class Channel {
			onmessage: ((event: MessageEvent) => void) | null = null;
			constructor(readonly name: string) {}
			postMessage() {}
			close() {}
		}
		global.BroadcastChannel = Channel as unknown as typeof BroadcastChannel;
		const options = {
			sseUrl: "http://localhost/events",
			syncUrl: "http://localhost/sync",
			channelName: "shared-test",
			shareConnection: true,
		};
		const first = createZuno(options);
		const second = createZuno(options);
		await Promise.resolve();
		expect(PassiveEventSource.instances).toHaveLength(1);
		first.stop();
		second.stop();
	});

	it("supports WebSocket downstream with HTTP mutation interoperability", async () => {
		class Socket {
			static instance: Socket;
			onopen: (() => void) | null = null;
			onmessage: ((message: MessageEvent) => void) | null = null;
			onclose: (() => void) | null = null;
			constructor(readonly url: string) {
				Socket.instance = this;
			}
			close() {}
		}
		global.WebSocket = Socket as unknown as typeof WebSocket;
		const onEvent = vi.fn();
		const transport = startWebSocket({
			url: "ws://localhost/events",
			syncUrl: "http://localhost/sync",
			clientId: "ws-client",
			onEvent,
		});
		Socket.instance.onmessage?.(
			new MessageEvent("message", {
				data: JSON.stringify({
					type: "state",
					event: { storeKey: "counter", state: 2, origin: "other" },
				}),
			}),
		);
		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({ state: 2, origin: "server" }),
		);
		await transport.dispatch({ storeKey: "counter", state: 3 });
		expect(fetch).toHaveBeenCalledWith(
			"http://localhost/sync",
			expect.objectContaining({ method: "POST" }),
		);
		transport.unsubscribe?.();
	});

	it("emits byte and fan-out telemetry at the gateway", () => {
		const metrics: ZunoMetric[] = [];
		const server = createZunoServerState();
		const gateway = createZunoConnectionGateway(server, {
			onMetric: (metric) => metrics.push(metric),
		});
		gateway.connect({
			metadata: {
				connectionId: "metrics",
				principal: { id: "p", partitions: [], topics: [] },
				protocolVersion: 0,
			},
			send: () => true,
			close: () => {},
		});
		applyStateEvent({ storeKey: "counter", state: 1 }, server);
		expect(metrics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "zuno.gateway.fanout_deliveries" }),
				expect.objectContaining({
					name: "zuno.gateway.bytes_sent",
					unit: "bytes",
				}),
			]),
		);
		gateway.stop();
	});
});
