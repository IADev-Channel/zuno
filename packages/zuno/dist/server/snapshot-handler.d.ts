import type { IncomingMessage, ServerResponse } from "http";
/**
 * Sends a snapshot of the universe state to the client.
 *
 * @param _req The incoming HTTP request object.
 * @param res The server response object, used to send the JSON universe state.
 */
export declare function sendSnapshot(_req: IncomingMessage, res: ServerResponse): void;
//# sourceMappingURL=snapshot-handler.d.ts.map