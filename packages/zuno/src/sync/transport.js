/**
 * Creates a transport for publishing Zuno state events.
 *
 * @param url The URL where events will be published.
 * @param headers Additional headers to include in the HTTP request.
 * @returns A ZunoTransport object with a publish method.
 */
export const createTransport = (url, headers) => {
    /** A set of subscribers to state events. */
    const subs = new Set();
    return {
        async publish(event) {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: JSON.stringify(event),
            });
            const json = await res.json().catch(() => null);
            return { ok: res.ok, status: res.status, json };
        },
        subscribe(cb) {
            subs.add(cb);
            return () => subs.delete(cb);
        },
    };
};
