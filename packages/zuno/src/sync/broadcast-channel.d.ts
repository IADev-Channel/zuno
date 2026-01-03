import type { ZunoBCOptions, ZunoStateEvent } from "./sync-types";
/**
 * Starts a broadcast channel for real-time state updates.
 * @param opts The options for the broadcast channel.
 * @returns An object with a `publish` method for publishing events and a `stop` method for stopping the channel.
 */
export declare const startBroadcastChannel: (opts: ZunoBCOptions) => {
    publish: (event: ZunoStateEvent) => void;
    hello: () => void;
    stop: () => void;
};
//# sourceMappingURL=broadcast-channel.d.ts.map