import type { ZunoStateEvent, ZunoTransport } from "./sync-types";

/** A function that handles incoming state events. */
type Subscriber = (event: ZunoStateEvent) => void;

/**
 * Creates a transport for publishing Zuno state events.
 *
 * @param url The URL where events will be published.
 * @param headers Additional headers to include in the HTTP request.
 * @returns A ZunoTransport object with a publish method.
 */
export const createTransport = (url: string, headers?: HeadersInit): ZunoTransport => {

  /** A set of subscribers to state events. */
  const subs = new Set<Subscriber>();

  return {
    async publish(event: ZunoStateEvent) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(event),
      });

      const json = await res.json().catch(() => null);

      return { ok: res.ok, status: res.status, json };
    },
    subscribe(cb: Subscriber) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
};