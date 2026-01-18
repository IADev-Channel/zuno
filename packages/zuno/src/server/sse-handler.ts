import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZunoStateEvent } from "../sync";
import { applyStateEvent } from "./apply-state-event";
import {
	getEventsAfter,
	getUniverseState,
	subscribeToStateEvents,
} from "./core";

type IncomingHeaders = IncomingMessage["headers"];

/**
 * Creates a Server-Sent Events (SSE) connection for Zuno state updates.
 */
export const createSSEConnection = (
	req: IncomingMessage,
	res: ServerResponse,
	headers: IncomingHeaders,
) => {
	res.writeHead(200, {
		"Cache-Control": "no-cache, no-transform",
		"Content-Type": "text/event-stream; charset=utf-8",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no",
		...headers,
	});

	res.flushHeaders?.();

	const raw =
		req.headers["last-event-id"] ||
		new URL(req.url || "", "http://localhost").searchParams.get("lastEventId");
	const lastEventId =
		Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "0"), 10) || 0;

	if (lastEventId > 0) {
		const missed = getEventsAfter(lastEventId);
		for (const event of missed) {
			res.write(`id: ${event.eventId}\n`);
			res.write(`event: state\n`);
			res.write(`data: ${JSON.stringify(event)}\n\n`);
		}
	} else {
		res.write(`event: snapshot\n`);
		res.write(`data: ${JSON.stringify(getUniverseState())}\n\n`);
	}

	const unsubscribe = subscribeToStateEvents((event: ZunoStateEvent) => {
		res.write(`id: ${event.eventId}\n`);
		res.write(`event: state\n`);
		res.write(`data: ${JSON.stringify(event)}\n\n`);
	});

	const heartbeat = setInterval(() => {
		res.write(`: ping ${Date.now()}\n\n`);
	}, 15000);

	res.write(": connected \n\n");

	req.on("close", () => {
		clearInterval(heartbeat);
		unsubscribe();
		res.end();
	});
};

/**
 * Synchronizes the Zuno universe state by applying an incoming event.
 */
export const syncUniverseState = (
	req: IncomingMessage,
	res: ServerResponse,
) => {
	const MAX_BODY_BYTES = 512 * 1024; // 512KB safety
	let body = "";

	req.on("data", (chunk: Buffer) => {
		body += chunk.toString("utf8");
		if (body.length > MAX_BODY_BYTES) {
			res.writeHead(413, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: false, reason: "PAYLOAD_TOO_LARGE" }));
			req.destroy();
		}
	});

	req.on("end", () => {
		try {
			const incoming: ZunoStateEvent = JSON.parse(
				body || "{}",
			) as unknown as ZunoStateEvent;
			const result = applyStateEvent(incoming);

			if (!result.ok) {
				if (result.reason === "VERSION_CONFLICT") {
					res.writeHead(409, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							ok: false,
							reason: "VERSION_CONFLICT",
							current: result.current,
						}),
					);
				}
				return;
			}

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true, event: result.event }));
		} catch {
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: false, reason: "INVALID_JSON" }));
		}
	});
};

export const setUniverseState = (req: IncomingMessage, res: ServerResponse) => {
	return syncUniverseState(req, res);
};
