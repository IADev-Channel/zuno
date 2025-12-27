import type { Store, Universe } from "../core/types";

/**
 * Represents a state event received from a Zuno SSE stream.
 */
export interface ZunoStateEvent {
  /** The kind of the event. */
  kind?: "state";

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

  /** The transport layer that published the event. */
  via?: "http" | "sse" | "bc";

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
  getSnapshot?: (data: Universe | Store<unknown>) => void;

  /**
   * Whether to enable optimistic updates.
   * If true, the client will update its state optimistically before receiving the server's response.
   */
  optimistic?: boolean;

  /**
   * The client id for the Broadcast Channel.
   */
  clientId?: string;

  /**
   * The name of the Broadcast Channel.
   */
  channelName?: string;

  /**
   * Callback when SSE connection is opened.
   */
  onOpen?: () => void;

  /**
   * Callback when SSE connection is closed.
   */
  onClose?: () => void;

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


/**
 * A record of a store's state and version.
 * @property {unknown} state - The state of the store.
 * @property {number} version - The version of the store.
 */
export type ZunoSnapshotRecord = {
  /**
   * The state of the store.
   */
  state: unknown;

  /**
   * The version of the store.
   */
  version: number
};

/**
 * A snapshot of the universe or store.
 * @property {Record<string, ZunoSnapshotRecord>} state - The state of the store.
 */
export type ZunoSnapshotState = Record<string, ZunoSnapshotRecord>;


/**
 * A message sent over the broadcast channel.
 * @property {"zuno:hello" | "zuno:snapshot" | "zuno:event"} type - The type of the message.
 * @property {string} origin - The origin of the message.
 * @property {string} target - The target of the message.
 * @property {ZunoSnapshotState} snapshot - The snapshot of the universe or store.
 * @property {ZunoStateEvent} event - The state event.
 */
export type BCMsg =
  | { type: "zuno:hello"; origin: string }
  | { type: "zuno:snapshot"; origin: string; target: string; snapshot: ZunoSnapshotState }
  | { type: "zuno:event"; origin: string; event: ZunoStateEvent };

/**
 * Options for starting a broadcast channel.
 * @property {string} channelName - The name of the broadcast channel.
 * @property {string} clientId - The client id for the broadcast channel.
 * @property {(event: ZunoStateEvent) => void} onEvent - The function to call when a new state event is received.
 * @property {() => ZunoSnapshotState} getSnapshot - The function to get the snapshot of the universe or store.
 */
export type ZunoBCOptions = {
  channelName: string;           // e.g. "zuno"
  clientId: string;              // unique per tab
  onEvent: (event: ZunoStateEvent) => void; // apply into universe/store
  getSnapshot?: () => ZunoSnapshotState;
  onSnapshot?: (snapshot: ZunoSnapshotState) => void;
};
