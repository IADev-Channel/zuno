import type { IncomingHttpHeaders } from "http";
/**
 * Options for creating an Express router for Zuno.
 */
type CreateZunoExpressOptions = {
    headers?: IncomingHttpHeaders;
};
/**
 * Creates an Express router for Zuno.
 *
 * @param opts - Options for creating the Express router.
 * @returns An object containing the SSE, sync, and snapshot handlers
 */
export declare function createZunoExpress(opts?: CreateZunoExpressOptions): {
    /**
     * Handles SSE connections.
     */
    sse: (req: import("express").Request, res: import("express").Response) => void;
    /**
     * Handles sync connections.
     */
    sync: (req: import("express").Request, res: import("express").Response) => void;
    /**
     * Handles snapshot connections.
     */
    snapshot: (req: import("express").Request, res: import("express").Response) => void;
};
export {};
//# sourceMappingURL=createZunoExpress.d.ts.map