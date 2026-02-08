import type { IncomingHttpHeaders } from "node:http";
import type { ZunoStateEvent } from "@iadev93/zuno";
import {
	applyStateEvent,
	createSSEConnection,
	sendSnapshot,
} from "@iadev93/zuno/server";
import type { Request, Response } from "express";

/**
 * Options for creating an Express router for Zuno.
 */
export type CreateZunoExpressOptions = {
	/** Optional custom headers to be sent with the SSE response. */
	headers?: IncomingHttpHeaders;
};

/**
 * Creates a Zuno Express instance.
 * Returns both granular handlers and a convenience `mount` helper.
 */
export function createZunoExpress(opts?: CreateZunoExpressOptions) {
	const { headers = {} } = opts ?? {};

	/**
	 * Granular handlers for maximum control.
	 * You can mount these manually to any route or wrap them in custom middleware.
	 */
	const handlers = {
		/**
		 * SSE connection handler.
		 * Usage: app.get('/custom/sse', zuno.sse);
		 */
		sse: (req: Request, res: Response) =>
			createSSEConnection(req, res, headers),

		/**
		 * Sync POST handler.
		 * Usage: app.post('/custom/sync', zuno.sync);
		 */
		sync: (req: Request, res: Response) => {
			const incoming = req.body as ZunoStateEvent;
			const result = applyStateEvent(incoming);

			if (!result.ok) {
				res.status(409).json({
					ok: false,
					reason: result.reason,
					current: result.current,
				});
				return;
			}

			res.status(200).json({ ok: true, event: result.event });
		},

		/**
		 * Snapshot GET handler.
		 * Usage: app.get('/custom/snapshot', zuno.snapshot);
		 */
		snapshot: (req: Request, res: Response) => sendSnapshot(req, res),
	};

	return {
		...handlers,
		/**
		 * Optional convenience method to mount all Zuno handlers at once.
		 * @param app The Express App or Router to mount the handlers on.
		 * @param basePath The base path for the Zuno routes (defaults to "/zuno").
		 */
		mount: (app: { get: Function; post: Function }, basePath = "/zuno") => {
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
	app: { get: Function; post: Function },
	opts?: CreateZunoExpressOptions & { basePath?: string },
) {
	const { basePath = "/zuno", ...rest } = opts ?? {};
	const zuno = createZunoExpress(rest);
	zuno.mount(app, basePath);
	return zuno;
}
