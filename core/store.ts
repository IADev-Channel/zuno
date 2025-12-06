import type { Store } from "./types";

/**
 * Creates a ZUNO state management store.
 *
 * @template T The type of the state managed by the store.
 * @param {T} initial The initial state value.
 * @returns {Store<T>} An object containing methods to interact with the store.
 */
export const createStore = <T>(initial: T): Store<T> => {
  let state = initial;
  const listeners = new Set<(state: T) => void>();

  return {
    /**
     * Retrieves the current state value.
     * @returns {T} The current state.
     */
    get: () => state,

    /**
     * Updates the state.
     * If `next` is a function, it will be called with the current state to derive the new state.
     * Otherwise, `next` will be set as the new state directly.
     * Listeners are notified only if the state actually changes.
     *
     * @param {T | ((prev: T) => T)} next The new state value or a function to derive it.
     */
    set: (next) => {
      const value =
        typeof next === "function"
          ? (next as (prev: T) => T)(state)
          : next;

      if (Object.is(value, state)) return;

      state = value;
      listeners.forEach((l) => l(state));
    },

    /**
     * Subscribes a listener function to state changes.
     * The listener will be called with the new state whenever it changes.
     *
     * @param {(state: T) => void} listener The function to be called on state changes.
     * @returns {() => void} A function to unsubscribe the listener.
     */
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};
