import { createZunoServerState } from "@iadev93/zuno/server";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createZunoExpress } from "../index";

describe("Zuno Express", () => {
	it("returns the server handlers", () => {
		const handlers = createZunoExpress();
		expect(handlers).toHaveProperty("sse");
		expect(handlers).toHaveProperty("sync");
		expect(handlers).toHaveProperty("snapshot");
	});

	it("uses an injected isolated server instance", () => {
		const server = createZunoServerState();
		expect(createZunoExpress({ server }).server).toBe(server);
	});

	it("creates an isolated server by default", () => {
		expect(createZunoExpress().server).not.toBe(createZunoExpress().server);
	});

	it("rejects unauthorized writes before mutating state", async () => {
		const server = createZunoServerState();
		const handlers = createZunoExpress({ server, authorize: () => false });
		const status = vi.fn().mockReturnThis();
		const json = vi.fn();
		const request = { body: { storeKey: "counter", state: 1 } } as Request;
		const response = { status, json } as unknown as Response;

		await handlers.sync(request, response);

		expect(status).toHaveBeenCalledWith(403);
		expect(server.getUniverseState()).toEqual({});
	});
});
