import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZunoStateEvent } from "../sync";
import { applyStateEvent } from "./apply-state-event";
import { defaultZunoServerState, type ZunoServerState } from "./core";

type IncomingHeaders = IncomingMessage["headers"];

/**
 * Creates a Server-Sent Events (SSE) connection for Zuno state updates.
 */
export const createSSEConnection = (
	req: IncomingMessage,
	res: ServerResponse,
	headers: IncomingHeaders,
	server: ZunoServerState = defaultZunoServerState,
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

	// 1. Subscribe FIRST and buffer events until snapshot/missed-events are sent
	const buffer: ZunoStateEvent[] = [];
	const pendingWrites: ZunoStateEvent[] = [];
	let isSyncing = true;
	let backpressured = false;
	let closed = false;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let unsubscribe = () => {};

	const closeConnection = () => {
		if (closed) return;
		closed = true;
		if (heartbeat) clearInterval(heartbeat);
		unsubscribe();
		res.end();
	};
	const flushPendingWrites = () => {
		backpressured = false;
		while (!closed && pendingWrites.length > 0) {
			const event = pendingWrites.shift();
			if (!event) continue;
			if (!res.write(formatStateEvent(event))) {
				backpressured = true;
				res.once("drain", flushPendingWrites);
				break;
			}
		}
	};
	const formatStateEvent = (event: ZunoStateEvent) =>
		`id: ${event.eventId}\nevent: state\ndata: ${JSON.stringify(event)}\n\n`;
	const writeEvent = (event: ZunoStateEvent) => {
		if (closed) return;
		if (backpressured) {
			if (pendingWrites.length >= server.maxSubscriberBuffer) {
				closeConnection();
				return;
			}
			pendingWrites.push(event);
			return;
		}
		if (!res.write(formatStateEvent(event))) {
			backpressured = true;
			res.once("drain", flushPendingWrites);
		}
	};
	const writeSnapshot = () => {
		res.write(`id: ${server.getLastEventId()}\n`);
		res.write("event: snapshot\n");
		res.write(`data: ${JSON.stringify(server.getUniverseState())}\n\n`);
	};

	unsubscribe = server.subscribeToStateEvents((event: ZunoStateEvent) => {
		if (isSyncing) {
			if (buffer.length >= server.maxSubscriberBuffer) {
				closeConnection();
				return;
			}
			buffer.push(event);
		} else {
			writeEvent(event);
		}
	});

	// 2. Send missed events or snapshot
	if (lastEventId > 0 && server.canReplayAfter(lastEventId)) {
		const missed = server.getEventsAfter(lastEventId);
		for (const event of missed) {
			writeEvent(event);
		}
	} else {
		writeSnapshot();
	}

	// 3. Flush buffer and switch to live mode
	isSyncing = false;
	while (buffer.length > 0) {
		const event = buffer.shift();
		if (event) writeEvent(event);
	}
	if (closed) return;

	heartbeat = setInterval(() => {
		if (closed) return;
		res.write(`: ping ${Date.now()}\n\n`);
	}, 15000);

	res.write(": connected \n\n");

	req.on("close", () => {
		closeConnection();
	});
};

/**
 * Synchronizes the Zuno universe state by applying an incoming event.
 */
export const syncUniverseState = (
	req: IncomingMessage,
	res: ServerResponse,
	server: ZunoServerState = defaultZunoServerState,
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
			const result = applyStateEvent(incoming, server);

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
				} else {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							ok: false,
							reason: result.reason,
							errors: result.errors,
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

export const setUniverseState = (
	req: IncomingMessage,
	res: ServerResponse,
	server: ZunoServerState = defaultZunoServerState,
) => {
	return syncUniverseState(req, res, server);
};
