import type { IncomingHttpHeaders } from "http"
import { createExpressSSEHandler } from "./express-sse-handler"
import { createExpressSyncHandler } from "./express-sync-handler"

/**
 * Options for creating an Express router for Zuno.
 */
type CreateZunoExpressOptions = {
  headers?: IncomingHttpHeaders
}

/**
 * Creates an Express router for Zuno.
 *
 * @param opts
 * @returns An object containing the SSE and sync handlers.
 */
export function createZunoExpress(opts?: CreateZunoExpressOptions) {
  const { headers } = opts ?? {}

  return {
    sse: createExpressSSEHandler(headers),
    sync: createExpressSyncHandler(),
  }
}
