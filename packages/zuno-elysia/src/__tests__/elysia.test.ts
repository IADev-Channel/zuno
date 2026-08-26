import { createZunoServerState } from "@iadev93/zuno/server";
import { describe, expect, it } from "vitest";
import { createZunoElysia } from "../index";

describe("Zuno Elysia", () => {
	it("returns the server handlers", () => {
		const handlers = createZunoElysia();
		expect(handlers).toHaveProperty("sse");
		expect(handlers).toHaveProperty("sync");
		expect(handlers).toHaveProperty("snapshot");
	});

	it("uses an injected isolated server instance", () => {
		const server = createZunoServerState();
		expect(createZunoElysia({ server }).server).toBe(server);
	});

	it("creates an isolated server by default", () => {
		expect(createZunoElysia().server).not.toBe(createZunoElysia().server);
	});

	it("rejects unauthorized writes before mutating state", async () => {
		const server = createZunoServerState();
		const handlers = createZunoElysia({ server, authorize: () => false });
		const set: { status?: number } = {};
		const result = await handlers.sync({
			body: { storeKey: "counter", state: 1 },
			set,
		});

		expect(set.status).toBe(403);
		expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
		expect(server.getUniverseState()).toEqual({});
	});
});
