import type { ZunoTransport } from "./sync-types";
/**
 * Creates a transport for publishing Zuno state events.
 *
 * @param url The URL where events will be published.
 * @param headers Additional headers to include in the HTTP request.
 * @returns A ZunoTransport object with a publish method.
 */
export declare const createTransport: (url: string, headers?: HeadersInit) => ZunoTransport;
//# sourceMappingURL=transport.d.ts.map