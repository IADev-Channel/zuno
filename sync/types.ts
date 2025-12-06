import type { Store, Universe } from "../core/types";

/**
 * Represents a state event received from a Zuno SSE stream.
 */
export interface ZunoStateEvent {
  /** The key of the store that emitted the state change. */
  storeKey: string;
  /** The new state value. */
  state: unknown;
}

/**
 * Options for configuring a Zuno Server-Sent Events (SSE) connection.
 * It can be configured either with a `Universe` or a specific `Store`.
 */
export type ZunoSSEOptions =
  | {
    /** The URL of the SSE endpoint. */
    url: string;
    /** The universe to subscribe to. */
    universe: Universe;
    store?: never;
  }
  | {
    /** The URL of the SSE endpoint. */
    url: string;
    /** The specific store to subscribe to. */
    store: Store<any>;
    universe?: never;
  };

/**
 * Defines the interface for a Zuno transport layer, responsible for
 * publishing and subscribing to state events.
 */
export interface ZunoTransport {
  /**
   * Publishes a state event to the transport.
   * @param event The state event to publish.
   */
  publish(event: ZunoStateEvent): void | Promise<void>;
  /**
   * Subscribes to state events from the transport.
   * @param handler The function to call when a new state event is received.
   */
  subscribe?(handler: (event: ZunoStateEvent) => void): void;
}