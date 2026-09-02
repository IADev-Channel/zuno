import type { IncomingMessage, ServerResponse } from "node:http";
import {
	createZunoSubscription,
	negotiateZunoProtocol,
	validateSubscriptions,
	type ZunoStateEvent,
	type ZunoSubscriptionPolicy,
	type ZunoSubscriptionPrincipal,
} from "../sync";
import { applyStateEvent } from "./apply-state-event";
import {
	createZunoConnectionGateway,
	type ZunoConnectionAdmission,
	type ZunoConnectionGateway,
	type ZunoGatewayMessage,
} from "./connection-gateway";
import { defaultZunoServerState, type ZunoServerState } from "./core";

type IncomingHeaders = IncomingMessage["headers"];
export type ZunoSSEAccess = {
	principal: ZunoSubscriptionPrincipal;
	policy?: ZunoSubscriptionPolicy;
};

const defaultGateways = new WeakMap<ZunoServerState, ZunoConnectionGateway>();
const gatewayFor = (server: ZunoServerState) => {
	let gateway = defaultGateways.get(server);
	if (!gateway) {
		gateway = createZunoConnectionGateway(server);
		defaultGateways.set(server, gateway);
	}
	return gateway;
};

export const createSSEConnection = (
	req: IncomingMessage,
	res: ServerResponse,
	headers: IncomingHeaders,
	server: ZunoServerState = defaultZunoServerState,
	access?: ZunoSSEAccess,
	gateway: ZunoConnectionGateway = gatewayFor(server),
) => {
	const requestUrl = new URL(req.url || "", "http://localhost");
	const requestedProtocol = Number.parseInt(
		requestUrl.searchParams.get("zunoProtocol") ?? "0",
		10,
	);
	const protocol = negotiateZunoProtocol(requestedProtocol);
	const requestedTopics = requestUrl.searchParams.getAll("topic");
	const requestedPartition = requestUrl.searchParams.get("partition") ?? "";
	let scoped: { partition: string; topics: Set<string> } | undefined;

	if (protocol.subscriptions) {
		if (!access || !requestedPartition || requestedTopics.length === 0) {
			res.writeHead(403, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({ ok: false, reason: "SUBSCRIPTION_CONTEXT_REQUIRED" }),
			);
			return;
		}
		const subscriptions = requestedTopics.map((topic, index) =>
			createZunoSubscription({
				id: `sse-${index}`,
				partition: requestedPartition,
				topic,
			}),
		);
		const validation = validateSubscriptions(
			subscriptions,
			access.principal,
			access.policy,
		);
		if (!validation.ok) {
			res.writeHead(403, { "Content-Type": "application/json" });
			res.end(JSON.stringify(validation));
			return;
		}
		scoped = {
			partition: requestedPartition,
			topics: new Set(requestedTopics),
		};
	}

	const raw =
		req.headers["last-event-id"] || requestUrl.searchParams.get("lastEventId");
	const lastEventId =
		Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "0"), 10) || 0;
	const buffer: ZunoGatewayMessage[] = [];
	let isSyncing = true;
	let closed = false;
	let admission: ZunoConnectionAdmission | undefined;
	const closeConnection = () => {
		if (closed) return;
		closed = true;
		if (admission?.ok) admission.close();
		res.end();
	};
	const formatStateEvent = (event: ZunoStateEvent) =>
		`id: ${event.eventId}\nevent: state\ndata: ${JSON.stringify(event)}\n\n`;
	const writeEvent = (event: ZunoStateEvent) => {
		if (!closed) return res.write(formatStateEvent(event));
		return false;
	};
	const writeSnapshot = () => {
		const state = scoped
			? server.getScopedUniverseState(scoped.partition, scoped.topics)
			: server.getUniverseState();
		res.write(`id: ${server.getLastEventId()}\n`);
		res.write("event: snapshot\n");
		res.write(`data: ${JSON.stringify(state)}\n\n`);
	};
	const send = (message: ZunoGatewayMessage) => {
		if (isSyncing) {
			if (buffer.length >= server.maxSubscriberBuffer) {
				closeConnection();
				return false;
			}
			buffer.push(message);
			return true;
		}
		if (message.type === "state") return writeEvent(message.event);
		if (message.type === "heartbeat")
			return res.write(`: ping ${message.timestamp}\n\n`);
		return res.write(
			`event: control\ndata: ${JSON.stringify(message.event)}\n\n`,
		);
	};
	const connectionId = crypto.randomUUID();
	const principal = access?.principal ?? {
		id: `anonymous:${connectionId}`,
		partitions: [],
		topics: [],
	};
	admission = gateway.connect({
		metadata: {
			connectionId,
			principal,
			protocolVersion: protocol.version,
			region: gateway.region,
			remoteAddress: req.socket?.remoteAddress,
			userAgent: req.headers["user-agent"],
		},
		partition: scoped?.partition,
		topics: scoped?.topics,
		send,
		close: closeConnection,
	});
	if (!admission.ok) {
		res.writeHead(503, {
			"Content-Type": "application/json",
			"Retry-After": String(Math.ceil(admission.retryAfterMs / 1000)),
		});
		res.end(JSON.stringify({ ok: false, reason: admission.reason }));
		return;
	}
	res.writeHead(200, {
		"Cache-Control": "no-cache, no-transform",
		"Content-Type": "text/event-stream; charset=utf-8",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no",
		"X-Zuno-Gateway": gateway.id,
		"X-Zuno-Protocol": String(protocol.version),
		...headers,
	});
	res.flushHeaders?.();
	res.on("drain", admission.writable);
	if (lastEventId > 0 && server.canReplayAfter(lastEventId)) {
		const missed = scoped
			? server.getScopedEventsAfter(
					lastEventId,
					scoped.partition,
					scoped.topics,
				)
			: server.getEventsAfter(lastEventId);
		for (const event of missed) writeEvent(event);
	} else writeSnapshot();
	isSyncing = false;
	while (buffer.length > 0) {
		const message = buffer.shift();
		if (message) send(message);
	}
	if (closed) return;
	res.write(": connected \n\n");
	req.on("close", closeConnection);
};

export const syncUniverseState = (
	req: IncomingMessage,
	res: ServerResponse,
	server: ZunoServerState = defaultZunoServerState,
	principal?: ZunoSubscriptionPrincipal,
) => {
	const MAX_BODY_BYTES = 512 * 1024;
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
			const incoming = JSON.parse(body || "{}") as unknown as ZunoStateEvent;
			const result = applyStateEvent(incoming, server, principal);
			if (!result.ok) {
				if (result.reason === "VERSION_CONFLICT") {
					res.writeHead(409, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							ok: false,
							reason: result.reason,
							current: result.current,
						}),
					);
				} else {
					res.writeHead(result.reason === "FORBIDDEN_SCOPE" ? 403 : 400, {
						"Content-Type": "application/json",
					});
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
	principal?: ZunoSubscriptionPrincipal,
) => syncUniverseState(req, res, server, principal);
