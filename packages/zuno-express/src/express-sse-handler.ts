import type { Request, Response } from "express"
import type { IncomingHttpHeaders } from "http";

import { createSSEConnection } from "@iadev/zuno/server";

/**
 * Creates an SSE handler for express.
 * @returns An Express handler function.
 */
export function createExpressSSEHandler(headers?: IncomingHttpHeaders) {
  /**
   * Creates an SSE connection for the client.
   */
  return (req: Request, res: Response) => createSSEConnection(req, res, headers ?? {})
}
