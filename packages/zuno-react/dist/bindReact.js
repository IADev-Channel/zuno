import * as React from "react";
import { toReadable } from "@iadev/zuno";
/**
 * The default equality function, using `Object.is` for strict equality comparison.
 * This is a common and safe default for comparing primitive values and references.
 */
const defaultEq = Object.is;
/**
 * Binds Zuno to React.
 * @param zuno The Zuno instance to bind.
 * @returns A React hook for accessing the store.
 */
export const bindReact = (zuno) => {
    /**
     * A custom hook for accessing a Zuno store in a React component.
     * @param store The Zuno store to access.
     * @param selector Optional selector function to extract a specific part of the store's state.
     * @param equalityFn Optional equality function to determine if the selected state has changed.
     * @returns The selected state from the store.
     */
    const useExternalStore = (readable, selector, equalityFn = defaultEq) => {
        /**
         * Memoized selector function.
         * If no selector is provided, the entire state is selected.
         */
        const select = React.useMemo(() => {
            return (selector ??
                ((s) => s));
        }, [selector]);
        /**
         * Reference to the last selected state.
         * Used to compare with the new state to determine if a re-render is needed.
         */
        const lastRef = React.useRef(null);
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
            const next = select(readable.getSnapshot());
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
            const prev = lastRef.current;
            /**
             * If the previous state is equal to the next state, return the previous state.
             * This prevents unnecessary re-renders.
             */
            if (equalityFn(prev, next))
                return prev;
            /**
             * Update the last state and return the next state.
             */
            lastRef.current = next;
            return next;
        }, [readable, select, equalityFn]);
        /**
         * Function to subscribe to changes in the store.
         * When the store changes, the component will re-render.
         */
        const subscribe = React.useCallback((onChange) => readable.subscribe(onChange), [readable]);
        const getServerSnapshot = React.useCallback(() => {
            const s = readable.getServerSnapshot ? readable.getServerSnapshot() : readable.getSnapshot();
            return select(s);
        }, [readable, select]);
        /**
         * Reset the last state and lastRef when the selector or equalityFn changes.
         * This ensures that the component re-renders when the selector or equalityFn changes.
         */
        React.useEffect(() => {
            hasLast.current = false;
            lastRef.current = null;
        }, [select, equalityFn]);
        /**
         * Returns the current state of the store.
         * If the state has changed since the last render, the component will re-render.
         */
        return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    };
    /**
     * Creates a store and returns a React hook for accessing the store.
     * @param storeKey The key of the store.
     * @param init The initialization function for the store.
     * @returns A React hook for accessing the store.
     */
    const store = (storeKey, init) => {
        /**
         * Creates a store and returns a React hook for accessing the store.
         */
        const base = zuno.store(storeKey, init);
        /**
         * Returns a React hook for accessing the store.
         */
        return {
            ...base,
            use: (selector, equalityFn = defaultEq) => {
                // IMPORTANT: call hook only inside components
                const readable = React.useMemo(() => toReadable(base.raw()), [storeKey]);
                return useExternalStore(readable, selector, equalityFn);
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
