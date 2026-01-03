/**
 * Creates a server transport for Zuno.
 *
 * @returns A ZunoTransport instance.
 */
export const createServerTransport = () => {
    /**
     * The set of subscribers to state events.
     */
    const subs = new Set();
    /**
     * Publishes a state event to all subscribers.
     */
    return {
        async publish(event) {
            for (const cb of subs)
                cb(event);
            return { ok: true, status: 200, json: null };
        },
        subscribe(cb) {
            subs.add(cb);
            return () => subs.delete(cb);
        },
    };
};
