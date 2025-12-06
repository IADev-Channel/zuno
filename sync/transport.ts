import type { ZunoStateEvent, ZunoTransport } from "./types";

/**
 * Creates an HTTP transport for publishing Zuno state events.
 *
 * @param url The URL where events will be published.
 * @param headers Additional headers to include in the HTTP request.
 * @returns A ZunoTransport object with a publish method.
 */
export const createHttpTransport = (url: string, headers?: HeadersInit): ZunoTransport => {
  return {
    async publish(event: ZunoStateEvent) {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(event),
      })
    }
  }
}