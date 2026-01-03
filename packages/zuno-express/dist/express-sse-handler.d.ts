import type { Request, Response } from "express";
import type { IncomingHttpHeaders } from "http";
/**
 * Creates an SSE handler for express.
 * @returns An Express handler function.
 */
export declare function createExpressSSEHandler(headers?: IncomingHttpHeaders): (req: Request, res: Response) => void;
//# sourceMappingURL=express-sse-handler.d.ts.map