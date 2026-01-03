import type { Store } from "./types";
/**
 * Creates a ZUNO state management store.
 *
 * @template T The type of the state managed by the store.
 * @param {T} initial The initial state value.
 * @returns {Store<T>} An object containing methods to interact with the store.
 */
export declare const createStore: <T>(initial: T) => Store<T>;
//# sourceMappingURL=store.d.ts.map