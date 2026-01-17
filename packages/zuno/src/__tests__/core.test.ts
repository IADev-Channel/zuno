import { describe, expect, it } from "vitest";
import { createStore, createUniverse } from "../core";

describe("Zuno Core", () => {
	describe("Store", () => {
		it("should create a store with initial value", () => {
			const store = createStore(10);
			expect(store.get()).toBe(10);
		});

		it("should update value", () => {
			const store = createStore(10);
			store.set(20);
			expect(store.get()).toBe(20);
		});

		it("should update value with updater function", () => {
			const store = createStore(10);
			store.set((prev) => prev + 5);
			expect(store.get()).toBe(15);
		});

		it("should notify subscribers", () => {
			const store = createStore(0);
			let value = 0;
			store.subscribe((v) => {
				value = v;
			});
			store.set(1);
			expect(value).toBe(1);
		});
	});

	describe("Universe", () => {
		it("should manage multiple stores", () => {
			const universe = createUniverse();
			const storeA = universe.getStore("a", () => 1);
			const storeB = universe.getStore("b", () => 2);

			expect(storeA.get()).toBe(1);
			expect(storeB.get()).toBe(2);

			const storeAAngain = universe.getStore("a", () => 100); // Should return existing
			expect(storeAAngain.get()).toBe(1); // Not 100
		});

		it("should take and restore snapshots", () => {
			const universe = createUniverse();
			const storeA = universe.getStore("a", () => 1);
			storeA.set(10);

			const snap = universe.snapshot();
			expect(snap).toEqual({ a: 10 });

			universe.restore({ a: 20, b: 30 });
			expect(universe.getStore("a", () => 0).get()).toBe(20);
			expect(universe.getStore("b", () => 0).get()).toBe(30);
		});
	});

	describe("Middleware", () => {
		it("should intercept actions", async () => {
			const logs: any[] = [];
			const loggerMiddleware =
				(api: any) => (next: any) => async (event: any) => {
					logs.push({ type: "before", event });
					const res = await next(event);
					logs.push({ type: "after", res });
					return res;
				};

			const { createZuno } = await import("../core");
			const zuno = createZuno({
				middleware: [loggerMiddleware],
				optimistic: true, // Ensure local apply happens
			});

			const store = zuno.store("test", () => 0);
			await store.set(1);

			expect(logs).toHaveLength(2);
			expect(logs[0].type).toBe("before");
			expect(logs[1].type).toBe("after");
		});

		it("should modify state in middleware", async () => {
			const modifierMiddleware =
				(api: any) => (next: any) => async (event: any) => {
					// Intercept and change state!
					if (event.storeKey === "mod") {
						return next({ ...event, state: event.state * 2 });
					}
					return next(event);
				};

			const { createZuno } = await import("../core");
			const zuno = createZuno({
				middleware: [modifierMiddleware],
				optimistic: true,
			});

			const store = zuno.store("mod", () => 1);
			await store.set(10); // Should become 20

			expect(store.get()).toBe(20);
		});
	});

	describe("Event IDs", () => {
		it("should track lastEventId", async () => {
			const { createZuno } = await import("../core");
			const zuno = createZuno();

			// Simulate applying an event with an ID (e.g. from server)
			// We can use the exposed `dispatch` but that's for outgoing.
			// Incoming events are typically handled via `applyIncomingEvent` internally or callbacks.
			// BUT `createZuno` exposes `hydrateSnapshot` which sets lastEventId.

			zuno.hydrateSnapshot({
				state: {},
				lastEventId: 100,
			});

			expect(zuno.getLastEventId()).toBe(100);
		});
	});
});
