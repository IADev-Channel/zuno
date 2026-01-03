/**
 * Starts a broadcast channel for real-time state updates.
 * @param opts The options for the broadcast channel.
 * @returns An object with a `publish` method for publishing events and a `stop` method for stopping the channel.
 */
export const startBroadcastChannel = (opts) => {
    const bc = new BroadcastChannel(opts.channelName);
    const post = (msg) => bc.postMessage(msg);
    /**
     * Handles incoming messages from the broadcast channel.
     * @param e The message event.
     */
    bc.onmessage = (e) => {
        /** Message */
        const msg = e.data;
        /** Invalid message */
        if (!msg || typeof msg !== "object")
            return;
        /** Ignore self messages */
        if (msg.origin === opts.clientId)
            return;
        /** Event message */
        if (msg.type === "zuno:event") {
            /** Event */
            const event = msg.event;
            /** Apply event */
            opts.onEvent(event);
            return;
        }
        /** Hello message */
        if (msg.type === "zuno:hello") {
            /** Someone joined: respond with snapshot (if available) */
            if (!opts.getSnapshot)
                return;
            /** Snapshot */
            const snapshot = opts.getSnapshot();
            /** Post snapshot */
            post({
                type: "zuno:snapshot",
                origin: opts.clientId,
                target: msg.origin,
                snapshot,
            });
            return;
        }
        /** Snapshot message */
        if (msg.type === "zuno:snapshot") {
            /** Accept only if snapshot is meant for me */
            if (msg.target !== opts.clientId)
                return;
            /** Apply snapshot */
            opts.onSnapshot?.(msg.snapshot);
            return;
        }
    };
    /** Publish event */
    const publish = (event) => {
        /** Post event */
        post({
            type: "zuno:event",
            origin: opts.clientId,
            event,
        });
    };
    /** Hello */
    const hello = () => {
        /** Post hello - to notify others about my presence */
        post({ type: "zuno:hello", origin: opts.clientId });
    };
    /** Stop */
    const stop = () => bc.close();
    return { publish, hello, stop };
};
