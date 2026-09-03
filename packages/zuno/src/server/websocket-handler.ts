import type { ZunoSubscriptionPrincipal } from "../sync";
import type { ZunoConnectionGateway } from "./connection-gateway";
import { createZunoConnectionGateway } from "./connection-gateway";
import type { ZunoServerState } from "./core";

export type ZunoWebSocketLike = {
	bufferedAmount: number;
	send(data: string): void;
	close(code?: number, reason?: string): void;
};

export type ZunoWebSocketConnectionOptions = {
	principal: ZunoSubscriptionPrincipal;
	partition?: string;
	topics?: ReadonlySet<string>;
	protocolVersion?: number;
	maxBufferedBytes?: number;
};

/**
 * Attaches an already-authenticated framework WebSocket to a Zuno gateway.
 * Mutations remain standard HTTP POST requests, so SSE and WebSocket clients
 * share the same authority, replay log, and conflict semantics.
 */
export const createWebSocketConnection = (
	socket: ZunoWebSocketLike,
	server: ZunoServerState,
	options: ZunoWebSocketConnectionOptions,
	gateway: ZunoConnectionGateway = createZunoConnectionGateway(server),
) => {
	const maxBufferedBytes = options.maxBufferedBytes ?? 1024 * 1024;
	const connectionId = crypto.randomUUID();
	const admission = gateway.connect({
		metadata: {
			connectionId,
			principal: options.principal,
			protocolVersion: options.protocolVersion ?? 1,
			region: gateway.region,
		},
		partition: options.partition,
		topics: options.topics,
		send(message) {
			if (socket.bufferedAmount >= maxBufferedBytes) return false;
			socket.send(JSON.stringify(message));
			return socket.bufferedAmount < maxBufferedBytes;
		},
		close: () => socket.close(1012, "Zuno gateway reconnect required"),
	});
	if (!admission.ok) {
		socket.close(1013, admission.reason);
		return admission;
	}
	const snapshot =
		options.partition && options.topics
			? server.getScopedUniverseState(options.partition, options.topics)
			: server.getUniverseState();
	socket.send(
		JSON.stringify({
			type: "snapshot",
			state: snapshot,
			lastEventId: server.getLastEventId(),
		}),
	);
	return admission;
};
