import { beforeEach, describe, expect, it, vi } from "vitest";
import { createZuno, shallowEqual } from "../index";
import * as sync from "../sync";

// Mock EventSource for Node environment
if (typeof globalThis.EventSource === "undefined") {
	// biome-ignore lint/suspicious/noExplicitAny: simple mock
	globalThis.EventSource = class {
		close() {}
		addEventListener() {}
	} as any;
}

describe("Performance & Batching", () => {
	it("should batch multiple updates into a single microtask sync", async () => {
		const mockDispatch = vi
			.fn()
			.mockResolvedValue({ ok: true, status: 200, json: {} });
		const startSSESpy = vi.spyOn(sync, "startSSE").mockReturnValue({
			dispatch: mockDispatch,
			unsubscribe: vi.fn(),
		});

		const zuno = createZuno({
			sseUrl: "http://localhost/sse",
			syncUrl: "http://localhost/sync",
			clientId: "test-client",
			batchSync: true,
		});

		// Perform multiple rapid updates
		zuno.set("counter", 1);
		zuno.set("counter", 2);
		zuno.set("counter", 3);

		expect(zuno.get("counter")).toBe(3);
		// Local BC should have been called 3 times (instant local sync)
		// but we are testing SSE batching here.

		// Wait for microtask flush
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Should have only called SSE dispatch ONCE for the final state
		expect(mockDispatch).toHaveBeenCalledTimes(1);
		expect(mockDispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				storeKey: "counter",
				state: 3,
				version: 3,
			}),
		);
	});

	it("should respect custom equality to prevent redundant notifications", () => {
		const zuno = createZuno();
		const listener = vi.fn();

		const store = zuno.store(
			"data",
			() => ({ count: 0 }),
			(s, i) => {
				if (i.type === "INC") return { ...s, count: s.count + 1 };
				if (i.type === "NOOP") return { ...s }; // Returns new reference
				return s;
			},
			shallowEqual,
		);

		store.subscribe(listener);

		zuno.mutate("data", { type: "NOOP" });
		expect(listener).not.toHaveBeenCalled(); // shallowEqual saved us

		zuno.mutate("data", { type: "INC" });
		expect(listener).toHaveBeenCalledTimes(1);
		expect(zuno.get("data")).toEqual({ count: 1 });
	});

	it("benchmark: incremental snapshots should be faster than rebuilding", () => {
		const zuno = createZuno();
		// Create 1000 stores
		for (let i = 0; i < 1000; i++) {
			zuno.store(`store_${i}`, () => i);
		}

		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			zuno.universe.snapshot(); // Should use cache
		}
		const end = performance.now();
		const duration = end - start;

		console.log(
			`[Benchmark] 1000 snapshot calls took ${duration.toFixed(2)}ms`,
		);
		expect(duration).toBeLessThan(100); // Should be very fast with caching
	});
});
