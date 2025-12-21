/**
 * Represents a generic store that can hold and manage a state of type T.
 * It provides methods to get, set, and subscribe to changes in the state.
 */
export interface Store<T> {
  /**
   * Retrieves the current value of the store's state.
   * @returns The current state.
   */
  get(): T;
  /**
   * Sets the new state of the store.
   * It can accept either a direct value or a function that receives the previous state
   * and returns the new state.
   * @param next The new state value or a function to derive the new state.
   */
  set(next: T | ((prev: T) => T)): void;
  /**
   * Subscribes a listener function to state changes.
   * The listener will be called whenever the state updates.
   * @param listener The function to call when the state changes.
   * @returns {boolean} A function to unsubscribe the listener. Calling this function will remove the subscription.
   */
  subscribe(listener: (state: T) => void): () => boolean;
}

/**
 * Represents a global container or manager for multiple stores,
 * often referred to as a "universe" in state management patterns.
 * It allows creating, retrieving, snapshotting, and restoring stores.
 */
export interface Universe {
  /**
   * Retrieves a store by its unique key. If the store does not exist,
   * it initializes it using the provided `init` function and then returns it.
   * @param key The unique identifier for the store.
   * @param init A function to initialize the store's state if it doesn't already exist.
   * @returns The requested store.
   */
  getStore<T>(key: string, init: () => T): Store<T>;
  /**
   * Creates a snapshot of the current state of all stores managed by the Universe.
   * The snapshot is a record where keys are store identifiers and values are their states.
   * @returns A record representing the current state of all stores.
   */
  snapshot(): Record<string, unknown>;
  /**
   * Restores the state of all stores in the Universe from a provided data snapshot.
   * This can be used to rehydrate the application's state.
   * @param data A record containing the state to restore for each store.
   */
  restore(data: Record<string, unknown>): void;

  /**
   * Deletes a store by its unique key.
   * @param key The unique identifier for the store to delete.
   */
  delete(key: string): void;

  /**
   * Clears all stores from the Universe.
   */
  clear(): void;

}

/**
 * Context for incoming events.
 * It is used to prevent loops (don’t re-apply your own broadcast) and to track per-store version tracking (SSE uses it, BC can ignore it).
 */
export type IncomingEventContext = {
  /** Used to prevent loops (don’t re-apply your own broadcast) */
  clientId: string;

  /** Per-store version tracking (SSE uses it, BC can ignore it) */
  versions?: Map<string, number>;

  /** Optional in-memory snapshot state for BC “hello/snapshot” */
  localState?: Map<string, unknown>;
};
