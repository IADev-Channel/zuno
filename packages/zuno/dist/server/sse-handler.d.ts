import type { IncomingMessage, ServerResponse } from "http";
type IncomingHeaders = IncomingMessage["headers"];
/**
 * Creates a Server-Sent Events (SSE) connection for Zuno state updates.
 */
export declare const createSSEConnection: (req: IncomingMessage, res: ServerResponse, headers: IncomingHeaders) => void;
/**
 * Synchronizes the Zuno universe state by applying an incoming event.
 *
 * This endpoint accepts a POST request with a JSON body representing a `ZunoStateEvent`.
 * It updates the universe state and then publishes the event to all SSE subscribers.
 *
 * @param req The incoming HTTP request object, expected to contain a JSON `ZunoStateEvent` in its body.
 * @param res The server response object, used to acknowledge the update or report errors.
 * @param transport The transport object used to publish the event to all SSE subscribers.
 */
export declare const syncUniverseState: (req: IncomingMessage, res: ServerResponse) => void;
/**
 * Sets the universe state to a specific version.
 * Backwards-compatible alias of syncUniverseState.
 */
export declare const setUniverseState: (req: IncomingMessage, res: ServerResponse) => void;
export {};
//# sourceMappingURL=sse-handler.d.ts.map