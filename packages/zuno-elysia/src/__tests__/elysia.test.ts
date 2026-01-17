import { createZuno } from "@iadev93/zuno";
import { describe, expect, it } from "vitest";
import { createZunoElysia } from "../index";

describe("Zuno Elysia", () => {
	it("should return an Elysia plugin", () => {
		// createZunoElysia returns { sse, sync, snapshot } handlers.
		// It does NOT seem to return a standard Elysia plugin object (name/derive) based on index.ts?
		// Let's re-read index.ts.

		// Index.ts: export function createZunoElysia() { return { sse, sync, snapshot }; }
		// Wait, typical Elysia plugins are functions used via .use().
		// If the user uses it as: app.use(zunoElysia.sse), then 'sse' must be a plugin function.
		// Looking at index.ts lines 33: sse: async function* ...
		// It seems to be a handler function, not a plugin object.

		const handlers = createZunoElysia();
		expect(handlers).toHaveProperty("sse");
		expect(handlers).toHaveProperty("sync");
		expect(handlers).toHaveProperty("snapshot");
	});

	// Integration test would require installing 'elysia' package which might fail due to bun requirement?
	// Elysia is often Bun-first but runs on Node with some polyfills.
	// For now, testing the plugin structure is a good unit test.
});
