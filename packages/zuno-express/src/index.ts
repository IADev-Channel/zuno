import type { IncomingHttpHeaders } from "node:http";
import type {
	ZunoStateEvent,
	ZunoSubscriptionPolicy,
	ZunoSubscriptionPrincipal,
} from "@iadev93/zuno";
import {
	applyStateEvent,
	createSSEConnection,
	createZunoConnectionGateway,
	createZunoServerState,
	sendSnapshot,
	type ZunoConnectionGateway,
	type ZunoServerState,
} from "@iadev93/zuno/server";
import type { Request, Response } from "express";

export type ZunoExpressAuthorizationContext = {
	action: "read" | "write";
	request: Request;
	event?: unknown;
};

/**
 * Options for creating an Express router for Zuno.
 */
export type CreateZunoExpressOptions = {
	/** Optional custom headers to be sent with the SSE response. */
	headers?: IncomingHttpHeaders;
	/** Isolated authoritative server state. A new instance is created by default. */
	server?: ZunoServerState;
	/** Shared connection gateway. Pass one instance to every framework mount in a process. */
	gateway?: ZunoConnectionGateway;
	/** Resolves authenticated subscription metadata for connection and write limits. */
	principal?: (
		request: Request,
	) => ZunoSubscriptionPrincipal | Promise<ZunoSubscriptionPrincipal>;
	subscriptionPolicy?: ZunoSubscriptionPolicy;
	/** Provider-agnostic authorization hook for snapshots, SSE, and mutations. */
	authorize?: (
		context: ZunoExpressAuthorizationContext,
	) => boolean | Promise<boolean>;
};

/**
 * Creates a Zuno Express instance.
 * Returns both granular handlers and a convenience `mount` helper.
 */
export function createZunoExpress(opts?: CreateZunoExpressOptions) {
	const {
		headers = {},
		server = createZunoServerState(),
		gateway: suppliedGateway,
		principal,
		subscriptionPolicy,
		authorize = () => true,
	} = opts ?? {};
	const gateway = suppliedGateway ?? createZunoConnectionGateway(server);
	const forbidden = (res: Response) =>
		res.status(403).json({ ok: false, reason: "FORBIDDEN" });

	/**
	 * Granular handlers for maximum control.
	 * You can mount these manually to any route or wrap them in custom middleware.
	 */
	const handlers = {
		/**
		 * SSE connection handler.
		 * Usage: app.get('/custom/sse', zuno.sse);
		 */
		sse: async (req: Request, res: Response) => {
			if (!(await authorize({ action: "read", request: req }))) {
				forbidden(res);
				return;
			}
			const identity = principal ? await principal(req) : undefined;
			createSSEConnection(
				req,
				res,
				headers,
				server,
				identity
					? { principal: identity, policy: subscriptionPolicy }
					: undefined,
				gateway,
			);
		},

		/**
		 * Sync POST handler.
		 * Usage: app.post('/custom/sync', zuno.sync);
		 */
		sync: async (req: Request, res: Response) => {
			const incoming = req.body as ZunoStateEvent;
			if (
				!(await authorize({ action: "write", request: req, event: incoming }))
			) {
				forbidden(res);
				return;
			}
			const identity = principal ? await principal(req) : undefined;
			const result = applyStateEvent(incoming, server, identity);

			if (!result.ok) {
				res.status(result.reason === "VERSION_CONFLICT" ? 409 : 400).json({
					ok: false,
					reason: result.reason,
					...(result.reason === "VERSION_CONFLICT"
						? { current: result.current }
						: { errors: result.errors }),
				});
				return;
			}

			res.status(200).json({ ok: true, event: result.event });
		},

		/**
		 * Snapshot GET handler.
		 * Usage: app.get('/custom/snapshot', zuno.snapshot);
		 */
		snapshot: async (req: Request, res: Response) => {
			if (!(await authorize({ action: "read", request: req }))) {
				forbidden(res);
				return;
			}
			sendSnapshot(req, res, server);
		},
	};

	return {
		...handlers,
		server,
		gateway,
		/**
		 * Optional convenience method to mount all Zuno handlers at once.
		 * @param app The Express App or Router to mount the handlers on.
		 * @param basePath The base path for the Zuno routes (defaults to "/zuno").
		 */
		mount: (
			app: {
				get: (...args: unknown[]) => unknown;
				post: (...args: unknown[]) => unknown;
			},
			basePath = "/zuno",
		) => {
			app.get(`${basePath}/sse`, handlers.sse);
			app.get(`${basePath}/snapshot`, handlers.snapshot);
			app.post(`${basePath}/sync`, handlers.sync);
		},
	};
}

/**
 * A standalone helper to mount Zuno handlers on an Express app/router.
 */
export function mountZuno(
	app: {
		get: (...args: unknown[]) => unknown;
		post: (...args: unknown[]) => unknown;
	},
	opts?: CreateZunoExpressOptions & { basePath?: string },
) {
	const { basePath = "/zuno", ...rest } = opts ?? {};
	const zuno = createZunoExpress(rest);
	zuno.mount(app, basePath);
	return zuno;
}
