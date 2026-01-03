import type { ZunoStateEvent } from "../sync/sync-types";
import type { Universe, ZunoSnapshot } from "./types";
/** Store */
type ZunoStore<T> = {
    get(): T;
    set(next: T): void;
    subscribe(cb: (state: T) => void): () => void;
};
export type CreateZunoOptions = {
    /** Universe */
    universe?: Universe;
    /** Optional transports */
    channelName?: string;
    /** SSE */
    sseUrl?: string;
    /** Sync */
    syncUrl?: string;
    /** Behavior */
    optimistic?: boolean;
    /** Client ID */
    clientId?: string;
};
/**
 * Creates a Zuno instance, which provides a state management system with optional synchronization
 * capabilities via Server-Sent Events (SSE) and BroadcastChannel.
 *
 * @param opts - Configuration options for the Zuno instance.
 * @param opts.universe - An optional pre-existing ZunoUniverse instance. If not provided, a new one will be created.
 * @param opts.channelName - An optional name for the BroadcastChannel to enable local tab synchronization.
 * @param opts.sseUrl - The URL for the Server-Sent Events endpoint to receive state updates from a server.
 * @param opts.syncUrl - The URL for the synchronization endpoint to send state updates to a server. Required if `sseUrl` is provided.
 * @param opts.optimistic - A boolean indicating whether state updates should be applied optimistically before server confirmation. Defaults to `true`.
 * @param opts.clientId - A unique identifier for the client. If not provided, a random UUID will be generated.
 * @returns An object containing methods to interact with the Zuno instance, including `getStore`, `destroy`, and `broadcast`.
 */
export declare const createZuno: (opts?: CreateZunoOptions) => {
    /** Universe */
    universe: Universe;
    /** Client ID */
    clientId: string;
    /** Get store */
    getStore: <T>(storeKey: string, init: () => T) => import("./types").Store<T>;
    /** Create store */
    store: <T>(storeKey: string, init: () => T) => {
        key: string;
        get: () => T;
        set: (next: T | ((prev: T) => T)) => Promise<any>;
        subscribe: (cb: (state: T) => void) => () => void;
        raw: () => ZunoStore<T>;
    };
    /** Get state */
    get: <T>(storeKey: string, init?: () => T) => T;
    /** Set state */
    set: <T>(storeKey: string, next: T | ((prev: T) => T), init?: () => T) => Promise<{
        ok: boolean;
        status: number;
        json: any;
    }>;
    /** Subscribe to store */
    subscribe: <T>(storeKey: string, init: () => T, cb: (state: T) => void) => () => boolean;
    /** Dispatch event */
    dispatch: (event: ZunoStateEvent) => Promise<{
        ok: boolean;
        status: number;
        json: any;
    }>;
    /** Stop */
    stop: () => void;
    /** Hydrate snapshot */
    hydrateSnapshot: (snapshot: ZunoSnapshot) => void;
    /** Get last event ID */
    getLastEventId: () => number;
    /** Set last event ID */
    setLastEventId: (id: number) => void;
};
export {};
//# sourceMappingURL=createZuno.d.ts.map