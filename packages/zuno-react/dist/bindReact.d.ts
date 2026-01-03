import { type ZunoSubscribableStore } from "@iadev/zuno";
/**
 * Type definition for an equality function.
 * It takes two values of the same type and returns true if they are considered equal, false otherwise.
 * Used to prevent unnecessary re-renders in React hooks when the selected state hasn't "meaningfully" changed.
 */
type EqualityFn<T> = (a: T, b: T) => boolean;
/**
 * Type definition for a selector function.
 * It takes the full state of a store and returns a selected portion of that state.
 * This allows components to subscribe only to the parts of the state they care about,
 * optimizing performance by avoiding re-renders for unrelated state changes.
 */
type Selector<TState, TSelected> = (state: TState) => TSelected;
/**
 * An extended interface for a Zuno store that includes methods for setting state
 * and a unique key identifier. This represents a store that has been "bound" or registered.
 */
type BoundStore<T> = {
    key: string;
    get: () => T;
    set: (next: T | ((prev: T) => T)) => Promise<any>;
    subscribe: (cb: (state: T) => void) => () => void;
    raw: () => ZunoSubscribableStore<T>;
};
/**
 * The core interface for the Zuno library, providing methods to create,
 * retrieve, and update stores.
 */
type ZunoCore = {
    store<T>(storeKey: string, init: () => T): BoundStore<T>;
    set<T>(storeKey: string, next: T | ((prev: T) => T), init?: () => T): Promise<any>;
    get<T>(storeKey: string, init?: () => T): T;
    stop?: () => void;
};
/**
 * An extended interface for a Zuno store that includes methods for setting state
 * and a unique key identifier. This represents a store that has been "bound" or registered.
 */
type ReactBoundStore<T> = BoundStore<T> & {
    /**
     * React hook for this store.
     * Optional selector + equality for derived values and avoiding rerenders.
     */
    use: <TSelected = T>(selector?: Selector<T, TSelected>, equalityFn?: EqualityFn<TSelected>) => TSelected;
};
/**
 * Binds Zuno to React.
 * @param zuno The Zuno instance to bind.
 * @returns A React hook for accessing the store.
 */
export declare const bindReact: (zuno: ZunoCore) => {
    store: <T>(storeKey: string, init: () => T) => ReactBoundStore<T>;
    set<T>(storeKey: string, next: T | ((prev: T) => T), init?: () => T): Promise<any>;
    get<T>(storeKey: string, init?: () => T): T;
    stop?: () => void;
};
export {};
//# sourceMappingURL=bindReact.d.ts.map