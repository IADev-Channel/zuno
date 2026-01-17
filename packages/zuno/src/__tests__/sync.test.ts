import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUniverse } from "../core";
import { startSSE, type ZunoStateEvent } from "../sync";

describe("Zuno Sync", () => {
	const universe = createUniverse();
	const versions = new Map<string, number>();
	const opts = {
		universe,
		url: "http://sse",
		syncUrl: "http://sync",
		optimistic: true,
		clientId: "test-client",
		versions,
		getLastEventId: () => 0,
	};

	// Mock EventSource
	class MockEventSource {
		url: string;
		constructor(url: string) {
			this.url = url;
			setTimeout(() => this.onopen?.(), 0);
		}
		onopen: (() => void) | null = null;
		onerror: (() => void) | null = null;
		onmessage: (() => void) | null = null;
		close() {}
		addEventListener() {}
		removeEventListener() {}
	}
	// biome-ignore lint/suspicious/noExplicitAny: Mocking global object
	global.EventSource = MockEventSource as any;

	beforeEach(() => {
		vi.clearAllMocks();
		universe.clear();
		versions.clear();
		// Reset global fetch mock with a safe default
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({}),
		});
		// Mock navigator online
		Object.defineProperty(navigator, "onLine", { writable: true, value: true });
	});

	it("should dispatch event via fetch", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ event: { version: 1 } }),
		});

		const transport = startSSE(opts);
		const event: ZunoStateEvent = { storeKey: "test", state: 1 };

		await transport.dispatch(event);

		expect(global.fetch).toHaveBeenCalledWith(
			"http://sync",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(event),
			}),
		);
		expect(universe.getStore("test", () => 0).get()).toBe(1); // Optimistic update
	});

	it("should queue events when offline", async () => {
		Object.defineProperty(navigator, "onLine", { value: false });

		const transport = startSSE(opts);
		const result = await transport.dispatch({ storeKey: "offline", state: 99 });

		expect(result.reason).toBe("OFFLINE_QUEUED");
		expect(global.fetch).not.toHaveBeenCalled();
		// Optimistic offline update
		expect(universe.getStore("offline", () => 0).get()).toBe(99);
	});

	it("should resolve conflict (Server Wins default helper)", async () => {
		// Simulate 409 Conflict
		const serverState = 100;
		(global.fetch as any).mockResolvedValueOnce({
			status: 409,
			json: async () => ({ current: { state: serverState, version: 10 } }),
		});

		const transport = startSSE(opts);
		const result = await transport.dispatch({ storeKey: "conflict", state: 5 });

		expect(result.reason).toBe("CONFLICT");
		// Should have updated local state to server state
		expect(universe.getStore("conflict", () => 0).get()).toBe(serverState);
		expect(versions.get("conflict")).toBe(10);
	});

	it("should use custom resolveConflict strategy", async () => {
		const serverState = { count: 100 };
		const localState = { count: 5 };
		const mergedState = { count: 105 }; // Simple merge logic

		// biome-ignore lint/suspicious/noExplicitAny: mock
		(global.fetch as any).mockResolvedValueOnce({
			status: 409,
			json: async () => ({ current: { state: serverState, version: 20 } }),
		});

		// Mock the SECOND fetch which is the auto-sync after resolution
		// biome-ignore lint/suspicious/noExplicitAny: mock
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({}),
		});

		const customOpts = {
			...opts,
			resolveConflict: (local: unknown, server: unknown) => {
				const l = local as { count: number };
				const s = server as { count: number };
				return { count: l.count + s.count };
			},
		};

		const transport = startSSE(customOpts);

		// Set initial local state so resolver has it
		universe.getStore("merge", () => ({ count: 0 })).set(localState);

		await transport.dispatch({ storeKey: "merge", state: localState });

		// 1. Should have updated local state to merged state
		expect(universe.getStore("merge", () => ({ count: 0 })).get()).toEqual(
			mergedState,
		);
		// 2. Should have updated version base to server version
		expect(versions.get("merge")).toBe(20);

		// 3. Should have called fetch TWICE:
		//    - 1st: The original dispatch (failed 409)
		//    - 2nd: The auto-sync dispatch with merged state
		expect(global.fetch).toHaveBeenCalledTimes(2);

		const secondCallBody = JSON.parse(
			// biome-ignore lint/suspicious/noExplicitAny: access mock calls
			(global.fetch as unknown as any).mock.calls[1][1].body,
		);
		expect(secondCallBody.state).toEqual(mergedState);
		expect(secondCallBody.baseVersion).toBe(20);
	});

	// Mock BroadcastChannel with shared listeners
	// biome-ignore lint/suspicious/noExplicitAny: mock channel data
	const listeners = new Map<string, Set<(e: any) => void>>();

	class SharedMockBC {
		name: string;

		constructor(name: string) {
			this.name = name;
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)?.add(this.handleMessage);
		}

		// biome-ignore lint/suspicious/noExplicitAny: mock
		onmessage: ((e: any) => void) | null = null;

		// biome-ignore lint/suspicious/noExplicitAny: mock
		handleMessage = (e: any) => {
			this.onmessage?.(e);
		};

		// biome-ignore lint/suspicious/noExplicitAny: mock
		postMessage(msg: any) {
			const channelListeners = listeners.get(this.name);
			channelListeners?.forEach((l) => {
				// Don't send to self? BC usually doesn't.
				// But here we rely on 'origin' check in application code loopback suppression.
				l({ data: msg });
			});
		}

		close() {
			listeners.get(this.name)?.delete(this.handleMessage);
		}
	}
	global.BroadcastChannel = SharedMockBC as any;

	it("should publish to BroadcastChannel", async () => {
		const { startBroadcastChannel } = await import("../sync");
		const onEvent = vi.fn();
		const bc = startBroadcastChannel({
			channelName: "test-channel",
			clientId: "client-A",
			onEvent,
			getSnapshot: () => ({}),
			onSnapshot: () => {},
		});

		bc.publish({ storeKey: "key", state: 1 });

		// Should NOT call onEvent because origin matches
		expect(onEvent).not.toHaveBeenCalled();
	});

	it("should receive from BroadcastChannel (Simulated Other Client)", async () => {
		const { startBroadcastChannel } = await import("../sync");
		const onEvent = vi.fn();
		// Client A
		const bc = startBroadcastChannel({
			channelName: "shared-channel",
			clientId: "client-A",
			onEvent,
			getSnapshot: () => ({}),
			onSnapshot: () => {},
		});

		// Simulate Client B publishing
		const otherBC = new SharedMockBC("shared-channel");
		otherBC.postMessage({
			type: "event",
			event: { storeKey: "key", state: 99, origin: "client-B" },
		});

		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				storeKey: "key",
				state: 99,
			}),
		);
	});
});
