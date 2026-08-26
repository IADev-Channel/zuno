import type { ZunoStateEvent } from "@iadev93/zuno";
import {
	applyStateEvent,
	createZunoServerState,
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
	/** Provider-agnostic authorization hook for snapshots, SSE, and mutations. */
	authorize?: (context: {
		action: "read" | "write";
		request: unknown;
		event?: unknown;
	}) => boolean | Promise<boolean>;
};

export function createZunoElysia(options: CreateZunoElysiaOptions = {}) {
	const server = options.server ?? createZunoServerState();
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
			set.headers["Content-Type"] = "text/event-stream";
			set.headers["Cache-Control"] = "no-cache";
			set.headers.Connection = "keep-alive";

			yield sse({ data: ": connected" });

			// 1. Subscribe FIRST to avoid missing events during snapshot/missed-events retrieval
			// biome-ignore lint/suspicious/noExplicitAny: queue of any SSE events
			const queue: any[] = [];
			let resolve: ((value: void | PromiseLike<void>) => void) | null = null;

			const unsubscribe = server.subscribeToStateEvents(
				(event: ZunoStateEvent) => {
					queue.push(
						sse({
							id: String(event.eventId),
							event: "state",
							data: JSON.stringify(event),
						}),
					);
					if (resolve) {
						resolve();
						resolve = null;
					}
				},
			);

			// 2. Decide if we send snapshot or missed events
			const rawLastEventId = headers["last-event-id"] || query?.lastEventId;
			const lastEventId = Number.parseInt(rawLastEventId || "0", 10) || 0;

			if (lastEventId > 0) {
				const missed = server.getEventsAfter(lastEventId);
				for (const event of missed) {
					yield sse({
						id: String(event.eventId),
						event: "state",
						data: JSON.stringify(event),
					});
				}
			} else {
				const snapshot = server.getUniverseState();
				yield sse({
					event: "snapshot",
					data: JSON.stringify(snapshot),
				});
			}

			// 3. Heartbeat interval
			const heartbeat = setInterval(() => {
				queue.push(sse({ data: `: ping ${Date.now()}` }));
				if (resolve) {
					resolve();
					resolve = null;
				}
			}, 15000);

			try {
				while (true) {
					if (queue.length === 0) {
						await new Promise<void>((r) => {
							resolve = r;
						});
					}

					while (queue.length > 0) {
						// biome-ignore lint/style/noNonNullAssertion: queue is checked for length > 0
						yield queue.shift()!;
					}
				}
			} finally {
				clearInterval(heartbeat);
				unsubscribe();
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
			const result = applyStateEvent(incoming, server);

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
	};
}
