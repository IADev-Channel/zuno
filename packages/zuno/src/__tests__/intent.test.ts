import { describe, expect, it, vi } from "vitest";
import { createZuno } from "../core";

describe("Zuno Intents", () => {
	it("should update state via a reducer using zuno.mutate", async () => {
		const zuno = createZuno();
		const COUNTER_KEY = "counter";

		const reducer = (state: number, intent: any) => {
			if (intent.type === "INC") return state + 1;
			if (intent.type === "ADD") return state + intent.payload;
			return state;
		};

		const counter = zuno.store(COUNTER_KEY, () => 0, reducer);

		await zuno.mutate(COUNTER_KEY, { type: "INC" });
		expect(counter.get()).toBe(1);

		await zuno.mutate(COUNTER_KEY, { type: "ADD", payload: 5 });
		expect(counter.get()).toBe(6);
	});

	it("should work with standard set (intent SET)", async () => {
		const zuno = createZuno();
		const key = "test";

		await zuno.set(key, "hello");
		expect(zuno.get(key)).toBe("hello");
	});

	it("should be observable via middleware", async () => {
		const intents: any[] = [];
		const middleware = () => (next: any) => async (event: any) => {
			if (event.intent) intents.push(event.intent);
			return next(event);
		};

		const zuno = createZuno({ middleware: [middleware] });
		const key = "test";

		await zuno.mutate(key, { type: "FOO" });
		await zuno.set(key, "bar");

		expect(intents).toEqual([{ type: "FOO" }, { type: "SET", payload: "bar" }]);
	});

	it("should handle optimistic: false correctly", async () => {
		const zuno = createZuno({ optimistic: false });
		const key = "test";

		// Should NOT apply locally yet
		await zuno.set(key, "hello");
		expect(zuno.get(key)).toBeUndefined();

		// Simulate reflection from server
		// origin must be clientId, version must be provided
		await zuno.dispatch({
			storeKey: key,
			state: "hello",
			version: 1,
			origin: zuno.clientId,
		});

		expect(zuno.get(key)).toBe("hello");
	});
});
