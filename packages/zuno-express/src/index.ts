import type { Request, Response } from "express";
import type { IncomingHttpHeaders } from "http";
import type { ZunoStateEvent } from "@iadev93/zuno";
import { 
  createSSEConnection, 
  applyStateEvent, 
  sendSnapshot 
} from "@iadev93/zuno/server";

/**
 * Options for creating an Express router for Zuno.
 */
export type CreateZunoExpressOptions = {
  /** Optional custom headers to be sent with the SSE response. */
  headers?: IncomingHttpHeaders;
};

/**
 * Creates a Zuno Express instance.
 * @param {CreateZunoExpressOptions} [opts] - Options for creating the Express router.
 * @returns {Object} An object with the following properties:
 *   - sse: An Express handler function that handles SSE connections.
 *   - sync: An Express handler function that handles sync POST requests.
 *   - snapshot: An Express handler function that handles snapshot GET requests.
 */
export function createZunoExpress(opts?: CreateZunoExpressOptions) {
  const { headers } = opts ?? {};

  return {
    /**
     * Handles SSE connections for Express.
     * @param {Request} req - Express request object.
     * @param {Response} res - Express response object.
     */
    sse: (req: Request, res: Response) => createSSEConnection(req, res, headers ?? {}),

    /**
     * Handles sync POST requests for Express.
     * @param {Request} req - Express request object.
     * @param {Response} res - Express response object.
     */
    sync: (req: Request, res: Response) => {
      const incoming = req.body as ZunoStateEvent;
      const result = applyStateEvent(incoming);

      if (!result.ok) {
        res.status(409).json({
          reason: result.reason,
          current: result.current,
        });
        return;
      }

      res.status(200).json({ ok: true, event: result.event });
    },

    /**
     * Handles snapshot GET requests for Express.
     * @param {Request} req - Express request object.
     * @param {Response} res - Express response object.
     */
    snapshot: (req: Request, res: Response) => sendSnapshot(req, res),
  };
}
