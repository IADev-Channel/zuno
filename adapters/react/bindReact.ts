import * as React from "react";

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
 * The default equality function, using `Object.is` for strict equality comparison.
 * This is a common and safe default for comparing primitive values and references.
 */
const defaultEq: EqualityFn<any> = Object.is;

/**
 * The core interface for a Zuno store.
 * It defines the minimal contract for interacting with a store's state.
 */
type ZunoStore<T> = {
  get(): T;
  subscribe(cb: (state: T) => void): () => void;
};

/**
 * An extended interface for a Zuno store that includes methods for setting state
 * and a unique key identifier. This represents a store that has been "bound" or registered.
 */
type BoundStore<T> = {
  key: string;
  get: () => T;
  set: (next: T | ((prev: T) => T)) => Promise<any>;
  subscribe: (cb: (state: T) => void) => () => void;
  raw: () => ZunoStore<T>;
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
  use: <TSelected = T>(
    selector?: Selector<T, TSelected>,
    equalityFn?: EqualityFn<TSelected>
  ) => TSelected;
};

/**
 * Binds Zuno to React.
 * @param zuno The Zuno instance to bind.
 * @returns A React hook for accessing the store.
 */
export const bindReact = (zuno: ZunoCore) => {

  /**
   * A custom hook for accessing a Zuno store in a React component.
   * @param store The Zuno store to access.
   * @param selector Optional selector function to extract a specific part of the store's state.
   * @param equalityFn Optional equality function to determine if the selected state has changed.
   * @returns The selected state from the store.
   */
  const useExternalStore = <TState, TSelected = TState>(
    store: ZunoStore<TState>,
    selector?: Selector<TState, TSelected>,
    equalityFn: EqualityFn<TSelected> = defaultEq
  ): TSelected => {

    /**
     * Memoized selector function.
     * If no selector is provided, the entire state is selected.
     */
    const select = React.useMemo(() => {
      return (selector ??
        ((s: TState) => s as unknown as TSelected)) as Selector<TState, TSelected>;
    }, [selector]);

    /**
     * Reference to the last selected state.
     * Used to compare with the new state to determine if a re-render is needed.
     */
    const lastRef = React.useRef<TSelected | null>(null);

    /**
     * Flag to indicate if the last state has been set.
     * Used to determine if the component should re-render.
     */
    const hasLast = React.useRef(false);

    /**
     * Function to get the current state of the store.
     * If the state has changed since the last render, the component will re-render.
     */
    const getSnapshot = React.useCallback(() => {

      /**
       * Get the current state of the store.
       */
      const next = select(store.get());

      /**
       * If the last state has not been set, set it and return the next state.
       * This is the initial state of the component.
       */
      if (!hasLast.current) {
        hasLast.current = true;
        lastRef.current = next;
        return next;
      }

      /**
       * Previous state.
       * Used to compare with the new state to determine if a re-render is needed.
       */
      const prev = lastRef.current as TSelected;

      /**
       * If the previous state is equal to the next state, return the previous state.
       * This prevents unnecessary re-renders.
       */
      if (equalityFn(prev, next)) return prev;

      /**
       * Update the last state and return the next state.
       */
      lastRef.current = next;
      return next;
    }, [store, select, equalityFn]);

    /**
     * Function to subscribe to changes in the store.
     * When the store changes, the component will re-render.
     */
    const subscribe = React.useCallback(
      (onChange: () => void) => store.subscribe(() => onChange()),
      [store]
    );

    /**
     * Returns the current state of the store.
     * If the state has changed since the last render, the component will re-render.
     */
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  /**
   * Creates a store and returns a React hook for accessing the store.
   * @param storeKey The key of the store.
   * @param init The initialization function for the store.
   * @returns A React hook for accessing the store.
   */
  const store = <T,>(storeKey: string, init: () => T): ReactBoundStore<T> => {

    /**
     * Creates a store and returns a React hook for accessing the store.
     */
    const base = zuno.store<T>(storeKey, init);

    /**
     * Returns a React hook for accessing the store.
     */
    return {
      ...base,
      use: <TSelected = T>(
        selector?: Selector<T, TSelected>,
        equalityFn: EqualityFn<TSelected> = defaultEq
      ) => {
        // IMPORTANT: call hook only inside components
        return useExternalStore<T, TSelected>(base.raw(), selector, equalityFn);
      },
    };
  };

  /**
   * Returns a Zuno instance with React-enhanced bound store.
   */
  return {
    ...zuno,
    store, // overrides store() with React-enhanced bound store
  };
};
