import { createSSEConnection } from "@iadev/zuno";
/**
 * Creates an SSE handler for express.
 * @returns An Express handler function.
 */
export function createExpressSSEHandler(headers) {
    /**
     * Creates an SSE connection for the client.
     */
    return (req, res) => createSSEConnection(req, res, headers ?? {});
}
