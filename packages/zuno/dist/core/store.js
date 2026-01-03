/**
 * Creates a ZUNO state management store.
 *
 * @template T The type of the state managed by the store.
 * @param {T} initial The initial state value.
 * @returns {Store<T>} An object containing methods to interact with the store.
 */
export const createStore = (initial) => {
    let state = initial;
    const listeners = new Set();
    return {
        get: () => state,
        set: (next) => {
            const value = typeof next === "function"
                ? next(state)
                : next;
            if (Object.is(value, state))
                return;
            state = value;
            listeners.forEach((l) => l(state));
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};
