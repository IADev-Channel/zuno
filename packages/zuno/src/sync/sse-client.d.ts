import type { ZunoSSEOptions, ZunoStateEvent } from "./sync-types";
/**
 * Starts a Server-Sent Events (SSE) connection to synchronize state from a server.
 * It can synchronize either a Zuno universe (collection of stores) or a single Zuno store.
 *
 * @param options - Configuration options for the SSE connection, including the URL,
 *                  and either a Zuno universe or a specific Zuno store to update.
 */
export declare const startSSE: (options: ZunoSSEOptions) => {
    unsubscribe: () => void;
    dispatch: (event: ZunoStateEvent) => Promise<{
        ok: boolean;
        status: number;
        json: unknown;
    } | {
        ok: boolean;
        status: number;
        json: any;
    }>;
};
//# sourceMappingURL=sse-client.d.ts.map