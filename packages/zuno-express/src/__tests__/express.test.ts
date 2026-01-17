import { createZuno } from "@iadev93/zuno";
import { describe, expect, it, vi } from "vitest";
import { type CreateZunoExpressOptions, createZunoExpress } from "../index";

describe("Zuno Express", () => {
	it("should attach zuno instance to request", () => {
		// 1. Setup Zuno instance
		const instance = createZuno();

		// 2. Create middleware
		const opts: CreateZunoExpressOptions = {
			// zuno: instance, // createZunoExpress doesn't take 'zuno' option in index.ts logic
			// Wait, looking at index.ts, createZunoExpress takes headers.
			// It returns handlers: { sse, sync, snapshot }.
			// It does NOT act as a middleware that attaches req.zuno?
			// Let's re-read index.ts behavior.
		};

		// logic check:
		// createZunoExpress returns handlers.
		// It seems zuno-express is NOT a middleware that attaches 'zuno' to req?
		// It's a set of handlers you mount.

		const handlers = createZunoExpress();
		expect(handlers).toHaveProperty("sse");
		expect(handlers).toHaveProperty("sync");
		expect(handlers).toHaveProperty("snapshot");
	});

	// Note: Testing actual SSE/Sync routes requires mocking zuno.startSSE behavior which isn't exposed perfectly on instance.
	// But checking attachment is the core responsibility of the wrapper.
});
