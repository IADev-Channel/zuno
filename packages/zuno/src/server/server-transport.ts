import type { ZunoStateEvent, ZunoTransport } from "../sync/sync-types";

/**
 * A subscriber to state events.
 */
type Subscriber = (event: ZunoStateEvent) => void;

/**
 * Creates a server transport for Zuno.
 *
 * @returns A ZunoTransport instance.
 */
export const createServerTransport = (): ZunoTransport => {
	/**
	 * The set of subscribers to state events.
	 */
	const subs = new Set<Subscriber>();

	/**
	 * Publishes a state event to all subscribers.
	 */
	return {
		async publish(event: ZunoStateEvent) {
			for (const cb of subs) cb(event);
			return { ok: true, status: 200, json: null };
		},
		subscribe(cb: Subscriber) {
			subs.add(cb);
			return () => subs.delete(cb);
		},
	};
};
