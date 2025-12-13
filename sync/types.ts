import type { Store, Universe } from "../core/types";

/**
 * Represents a state event received from a Zuno SSE stream.
 */
export interface ZunoStateEvent {
  /** The key of the store that emitted the state change. */
  storeKey: string;

  /** The new state value. */
  state: unknown;

  /** The version of the store before the state change to resolve conflicts and ordering. */
  baseVersion?: number;

  /** The authoritative version after server applies. */
  version?: number;

  /** The origin of the state change. */
  origin?: string;

  /** The timestamp of the state change. */
  ts?: number;

  /** The global monotonic id of the event. */
  eventId?: number;   
}

export type ZunoSSEOptionsDefault = {

  /**
   * The URL of the SSE endpoint.
   * */
  url: string;

  /**
   * The URL of the Sync endpoint.
  */
  syncUrl: string;

  /**
   * Get the snapshot of the universe or store.
   */
  getSnapshot: (data: Universe | Store<unknown>) => void;

  /**
   * Whether to enable optimistic updates.
   * If true, the client will update its state optimistically before receiving the server's response.
   */
  optimistic?: boolean;
}

/**
 * Options for configuring a Zuno Server-Sent Events (SSE) connection.
 * It can be configured either with a `Universe` or a specific `Store`.
 */
export type ZunoSSEOptions =
  ZunoSSEOptionsDefault &
  ({
    /** The universe to subscribe to. */
    universe: Universe;
    store?: never;
  }
    | {
      /** The specific store to subscribe to. */
      store: Store<any>;
      universe?: never;
    });

/**
 * Defines the interface for a Zuno transport layer, responsible for
 * publishing and subscribing to state events.
 */
export interface ZunoTransport {
  /**
   * Publishes a state event to the transport.
   * @param event The state event to publish.
   */
  publish(event: ZunoStateEvent): { ok: boolean, status: number, json: unknown } | Promise<{ ok: boolean, status: number, json: any }>;
  /**
   * Subscribes to state events from the transport.
   * @param handler The function to call when a new state event is received.
   */
  subscribe?(handler: (event: ZunoStateEvent) => void): void;
}