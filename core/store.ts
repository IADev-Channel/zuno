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
    get: () => state,
    set: (next) => {
      const value =
        typeof next === "function"
          ? (next as (prev: T) => T)(state)
          : next;

      if (Object.is(value, state)) return;

      state = value;
      listeners.forEach((l) => l(state));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};
