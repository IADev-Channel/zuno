import {
	createZunoSubscription,
	negotiateZunoProtocol,
	validateSubscriptions,
	type ZunoStateEvent,
	type ZunoSubscriptionPolicy,
	type ZunoSubscriptionPrincipal,
} from "@iadev93/zuno";
import {
	applyStateEvent,
	createZunoConnectionGateway,
	createZunoServerState,
	type ZunoConnectionGateway,
	type ZunoGatewayMessage,
	type ZunoServerState,
} from "@iadev93/zuno/server";
import { sse } from "elysia";

/**
 * Creates a Zuno Elysia instance.
 * @returns {Object} An object with the following properties:
 *   - sse: An async generator function that handles SSE connections for Elysia.
 *     @property {Object} set - Elysia response object.
 *     @property {Object} headers - Elysia request headers.
 *     @property {Object} query - Elysia request query parameters.
 *   - sync: A function that handles sync POST requests for Elysia.
 *     @property {Object} body - Elysia request body.
 *     @property {Object} set - Elysia response object.
 *   - snapshot: A function that handles snapshot GET requests for Elysia.
 *   - snapshot: A function that handles snapshot GET requests for Elysia.
 */
export type CreateZunoElysiaOptions = {
	/** Isolated authoritative server state. A new instance is created by default. */
	server?: ZunoServerState;
	gateway?: ZunoConnectionGateway;
	principal?: (
		request: unknown,
	) => ZunoSubscriptionPrincipal | Promise<ZunoSubscriptionPrincipal>;
	subscriptionPolicy?: ZunoSubscriptionPolicy;
	/** Provider-agnostic authorization hook for snapshots, SSE, and mutations. */
	authorize?: (context: {
		action: "read" | "write";
		request: unknown;
		event?: unknown;
	}) => boolean | Promise<boolean>;
};

export function createZunoElysia(options: CreateZunoElysiaOptions = {}) {
	const server = options.server ?? createZunoServerState();
	const gateway = options.gateway ?? createZunoConnectionGateway(server);
	const authorize = options.authorize ?? (() => true);
	return {
		/**
		 * Handles SSE connections for Elysia using an async generator.
		 * @param {Object} param - Elysia request object.
		 * @param {Object} param.set - Elysia response object.
		 * @param {Object} param.headers - Elysia request headers.
		 * @param {Object} param.query - Elysia request query parameters.
		 */
		// biome-ignore lint/suspicious/noExplicitAny: Elysia request object
		sse: async function* (request: any) {
			const { set, headers, query } = request;
			if (!(await authorize({ action: "read", request }))) {
				set.status = 403;
				return;
			}
			const requestedProtocol = Number.parseInt(query?.zunoProtocol ?? "0", 10);
			const protocol = negotiateZunoProtocol(requestedProtocol);
			const requestedTopics = Array.isArray(query?.topic)
				? query.topic
				: typeof query?.topic === "string"
					? [query.topic]
					: [];
			const requestedPartition = query?.partition ?? "";
			const identity = options.principal
				? await options.principal(request)
				: undefined;
			let scoped: { partition: string; topics: Set<string> } | undefined;
			if (protocol.subscriptions) {
				if (!identity || !requestedPartition || requestedTopics.length === 0) {
					set.status = 403;
					return;
				}
				const validation = validateSubscriptions(
					requestedTopics.map((topic: string, index: number) =>
						createZunoSubscription({
							id: `sse-${index}`,
							partition: requestedPartition,
							topic,
						}),
					),
					identity,
					options.subscriptionPolicy,
				);
				if (!validation.ok) {
					set.status = 403;
					return;
				}
				scoped = {
					partition: requestedPartition,
					topics: new Set(requestedTopics),
				};
			}
			set.headers["Content-Type"] = "text/event-stream";
			set.headers["Cache-Control"] = "no-cache";
			set.headers.Connection = "keep-alive";

			// 1. Subscribe FIRST to avoid missing events during snapshot/missed-events retrieval
			const queue: ZunoGatewayMessage[] = [];
			let overflowed = false;
			let resolve: ((value: void | PromiseLike<void>) => void) | null = null;
			const enqueue = (message: ZunoGatewayMessage) => {
				if (queue.length >= server.maxSubscriberBuffer) return false;
				queue.push(message);
				if (resolve) {
					resolve();
					resolve = null;
				}
				return true;
			};

			const connectionId = crypto.randomUUID();
			const connectionPrincipal = identity ?? {
				id: `anonymous:${connectionId}`,
				partitions: [],
				topics: [],
			};
			const admission = gateway.connect({
				metadata: {
					connectionId,
					principal: connectionPrincipal,
					protocolVersion: protocol.version,
					region: gateway.region,
					userAgent: headers["user-agent"],
				},
				partition: scoped?.partition,
				topics: scoped?.topics,
				send: enqueue,
				close: () => {
					overflowed = true;
					resolve?.();
				},
			});
			if (!admission.ok) {
				set.status = 503;
				set.headers["Retry-After"] = String(
					Math.ceil(admission.retryAfterMs / 1000),
				);
				return;
			}
			set.headers["X-Zuno-Gateway"] = gateway.id;
			yield sse({ data: ": connected" });

			// 2. Decide if we send snapshot or missed events
			const rawLastEventId = headers["last-event-id"] || query?.lastEventId;
			const lastEventId = Number.parseInt(rawLastEventId || "0", 10) || 0;

			if (lastEventId > 0 && server.canReplayAfter(lastEventId)) {
				const missed = scoped
					? server.getScopedEventsAfter(
							lastEventId,
							scoped.partition,
							scoped.topics,
						)
					: server.getEventsAfter(lastEventId);
				for (const event of missed) {
					yield sse({
						id: String(event.eventId),
						event: "state",
						data: JSON.stringify(event),
					});
				}
			} else {
				const snapshot = scoped
					? server.getScopedUniverseState(scoped.partition, scoped.topics)
					: server.getUniverseState();
				yield sse({
					id: String(server.getLastEventId()),
					event: "snapshot",
					data: JSON.stringify(snapshot),
				});
			}

			try {
				while (true) {
					if (overflowed) return;
					if (queue.length === 0) {
						await new Promise<void>((r) => {
							resolve = r;
						});
					}
					if (overflowed) return;

					while (queue.length > 0) {
						// biome-ignore lint/style/noNonNullAssertion: queue is checked for length > 0
						const message = queue.shift()!;
						if (message.type === "state")
							yield sse({
								id: String(message.event.eventId),
								event: "state",
								data: JSON.stringify(message.event),
							});
						else if (message.type === "heartbeat")
							yield sse({ data: `: ping ${message.timestamp}` });
						else
							yield sse({
								event: "control",
								data: JSON.stringify(message.event),
							});
						admission.writable();
					}
				}
			} finally {
				admission.close();
			}
		},

		/**
		 * Handles sync POST requests for Elysia.
		 * @param {Object} param - Elysia request object.
		 * @param {Object} param.body - Elysia request body.
		 * @param {Object} param.set - Elysia response object.
		 * @returns {Object} An object with the following properties:
		 *   - ok: A boolean indicating whether the sync was successful.
		 *   - event: The event that was applied to the universe.
		 */
		// biome-ignore lint/suspicious/noExplicitAny: Elysia request body
		sync: async (request: any) => {
			const { body, set } = request;
			const incoming = body as ZunoStateEvent;
			if (!(await authorize({ action: "write", request, event: incoming }))) {
				set.status = 403;
				return { ok: false, reason: "FORBIDDEN" };
			}
			const identity = options.principal
				? await options.principal(request)
				: undefined;
			const result = applyStateEvent(incoming, server, identity);

			if (!result.ok) {
				set.status = result.reason === "VERSION_CONFLICT" ? 409 : 400;
				return {
					ok: false,
					reason: result.reason,
					...(result.reason === "VERSION_CONFLICT"
						? { current: result.current }
						: { errors: result.errors }),
				};
			}

			return { ok: true, event: result.event };
		},

		/**
		 * Handles snapshot GET requests for Elysia.
		 * @returns {Object} An object with the following properties:
		 *   - state: The current state of the universe.
		 *   - version: The version of the universe.
		 *   - lastEventId: The ID of the last event in the universe.
		 */
		snapshot: async (request: { set: { status?: number } }) => {
			if (!(await authorize({ action: "read", request }))) {
				request.set.status = 403;
				return { ok: false, reason: "FORBIDDEN" };
			}
			return {
				state: server.getUniverseState(),
				lastEventId: server.getLastEventId(),
			};
		},
		server,
		gateway,
	};
}
