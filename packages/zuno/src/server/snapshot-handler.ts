import type { IncomingMessage, ServerResponse } from "http";
import { getLastEventId, getUniverseState } from "./core";

/**
 * Sends a snapshot of the current universe state to the response.
 * Compatible with both Express and raw Node.js http.
 */
export function sendSnapshot(_req: IncomingMessage, res: ServerResponse) {
	const snapshot = {
		state: getUniverseState(),
		lastEventId: getLastEventId(),
	};

	// Check for Express-like .json() method
	// biome-ignore lint/suspicious/noExplicitAny: Checking for dynamic .json() method on response object
	if ("json" in res && typeof (res as any).json === "function") {
		// biome-ignore lint/suspicious/noExplicitAny: Calling dynamic .json() method
		(res as any).json(snapshot);
	} else {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify(snapshot));
	}
}
