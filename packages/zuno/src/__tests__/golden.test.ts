import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUniverse, createZuno } from "../core";

describe("Zuno Golden Tests", () => {
	const universe = createUniverse();
	const versions = new Map<string, number>();

	// Mock EventSource for startSSE
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
	globalThis.EventSource = MockEventSource as any;

	beforeEach(() => {
		vi.clearAllMocks();
		universe.clear();
		versions.clear();

		// Mock fetch
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ event: { version: 1 } }),
		});

		// Mock navigator.onLine
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			value: true,
			writable: true,
		});
	});

	it("Golden Flow 1: Offline Queue + Reconnect Apply Order (FIFO)", async () => {
		// 1. Setup
		Object.defineProperty(navigator, "onLine", { value: false });
		const zuno = createZuno({
			universe,
			syncUrl: "http://sync",
			sseUrl: "http://sse",
			optimistic: true,
		});

		// 2. Dispatch events for DIFFERENT keys to verify order
		const _e1 = zuno.set("a", 1);
		const _e2 = zuno.set("b", 2);
		const _e3 = zuno.set("c", 3);

		expect(universe.getStore("a", () => 0).get()).toBe(1);
		expect(globalThis.fetch).not.toHaveBeenCalled();

		// 3. Reconnect
		Object.defineProperty(navigator, "onLine", { value: true });
		window.dispatchEvent(new Event("online"));

		// Give it a moment to flush (flushQueue is async)
		await new Promise((resolve) => setTimeout(resolve, 10));

		// 4. Verify Order (FIFO for distinct keys)
		// biome-ignore lint/suspicious/noExplicitAny: mock
		const calls = (globalThis.fetch as any).mock.calls;
		expect(calls.length).toBe(3);

		// biome-ignore lint/suspicious/noExplicitAny: mock
		const bodies = calls.map((c: any) => JSON.parse(c[1].body));
		expect(bodies[0].storeKey).toBe("a");
		expect(bodies[1].storeKey).toBe("b");
		expect(bodies[2].storeKey).toBe("c");
	});

	it("Golden Flow 2: Conflict Resolution Determinism", async () => {
		const resolveConflict = (local: any, server: any) => {
			if (typeof local === "number" && typeof server === "number") {
				return Math.max(local, server);
			}
			return server;
		};

		const zuno = createZuno({
			universe,
			syncUrl: "http://sync",
			sseUrl: "http://sse",
			resolveConflict,
		});

		// Case A: Local wins (150 > 100) -> Should retry and succeed
		// biome-ignore lint/suspicious/noExplicitAny: mock
		(globalThis.fetch as any).mockResolvedValueOnce({
			status: 409,
			json: async () => ({ current: { state: 100, version: 10 } }),
		});

		const resA = await zuno.set("conflict", 150);
		expect(resA.ok).toBe(true);
		expect(universe.getStore("conflict", () => 0).get()).toBe(150);

		// Case B: Server wins (100 > 50) -> Should adopt server and stop (status CONFLICT)
		// biome-ignore lint/suspicious/noExplicitAny: mock
		(globalThis.fetch as any).mockResolvedValueOnce({
			status: 409,
			json: async () => ({ current: { state: 100, version: 20 } }),
		});

		const resB = await zuno.set("conflict", 50);
		expect(resB.ok).toBe(false);
		expect(resB.reason).toBe("CONFLICT");
		expect(universe.getStore("conflict", () => 0).get()).toBe(100);
	});

	it("Golden Flow 3: Middleware Execution Order + Error Isolation", async () => {
		const order: string[] = [];

		// biome-ignore lint/suspicious/noExplicitAny: middleware interface
		const m1 = () => (next: any) => async (event: any) => {
			order.push("m1-start");
			const res = await next(event);
			order.push("m1-end");
			return res;
		};

		// biome-ignore lint/suspicious/noExplicitAny: middleware interface
		const m2 = () => (next: any) => async (event: any) => {
			order.push("m2-start");
			const res = await next(event);
			order.push("m2-end");
			return res;
		};

		// biome-ignore lint/suspicious/noExplicitAny: middleware interface
		const isolator = () => (next: any) => async (event: any) => {
			try {
				return await next(event);
			} catch (_err) {
				order.push("caught-error");
				return { ok: false, status: 500 };
			}
		};

		const thrower = () => () => async () => {
			throw new Error("Boom");
		};

		const zuno = createZuno({
			universe,
			middleware: [m1, isolator, m2],
		});

		await zuno.set("test", 1);
		expect(order).toEqual(["m1-start", "m2-start", "m2-end", "m1-end"]);

		// Error Isolation
		order.length = 0;
		const zunoError = createZuno({
			universe,
			middleware: [m1, isolator, thrower],
		});

		const res = await zunoError.set("test", 2);
		expect(res.ok).toBe(false);
		expect(order).toEqual(["m1-start", "caught-error", "m1-end"]);
	});
});
