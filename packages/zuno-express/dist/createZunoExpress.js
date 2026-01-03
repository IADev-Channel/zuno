import { createExpressSSEHandler } from "./express-sse-handler";
import { createExpressSyncHandler } from "./express-sync-handler";
import { createExpressSnapshotHandler } from "./express-snapshot-handler";
/**
 * Creates an Express router for Zuno.
 *
 * @param opts - Options for creating the Express router.
 * @returns An object containing the SSE, sync, and snapshot handlers
 */
export function createZunoExpress(opts) {
    const { headers } = opts ?? {};
    return {
        /**
         * Handles SSE connections.
         */
        sse: createExpressSSEHandler(headers),
        /**
         * Handles sync connections.
         */
        sync: createExpressSyncHandler(),
        /**
         * Handles snapshot connections.
         */
        snapshot: createExpressSnapshotHandler(),
    };
}
