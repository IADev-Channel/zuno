import * as React from "react";
import { type ZunoReadable, type ZunoSubscribableStore, toReadable, createZuno, type CreateZunoOptions } from "@iadev93/zuno";

/**
 * Type definition for an equality function.
 * It takes two values of the same type and returns true if they are considered equal, false otherwise.
 * Used to prevent unnecessary re-renders in React hooks when the selected state hasn't "meaningfully" changed.
 */
export type EqualityFn<T> = (a: T, b: T) => boolean;

/**
 * Type definition for a selector function.
 * It takes the full state of a store and returns a selected portion of that state.
 * This allows components to subscribe only to the parts of the state they care about,
 * optimizing performance by avoiding re-renders for unrelated state changes.
 */
export type Selector<TState, TSelected> = (state: TState) => TSelected;

/**
 * The default equality function, using `Object.is` for strict equality comparison.
 * This is a common and safe default for comparing primitive values and references.
 */
const defaultEq: EqualityFn<any> = Object.is;

/**
 * An extended interface for a Zuno store that includes methods for setting state
 * and a unique key identifier. This represents a store that has been "bound" or registered.
 */
export type BoundStore<T> = {
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
export type ZunoCore = {
  store<T>(storeKey: string, init: () => T): BoundStore<T>;
  set<T>(storeKey: string, next: T | ((prev: T) => T), init?: () => T): Promise<any>;
  get<T>(storeKey: string, init?: () => T): T;
  stop?: () => void;
};

/**
 * An extended interface for a Zuno store that includes React-specific features.
 */
export type ReactBoundStore<T> = BoundStore<T> & {
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
 * @returns A React-enhanced Zuno instance.
 */
export const bindReact = (zuno: ZunoCore) => {
  /**
   * A custom hook for accessing a Zuno store in a React component.
   */
  const useExternalStore = <TState, TSelected = TState>(
    readable: ZunoReadable<TState>,
    selector?: Selector<TState, TSelected>,
    equalityFn: EqualityFn<TSelected> = defaultEq
  ): TSelected => {
    const select = React.useMemo(() => {
      return (selector ??
        ((s: TState) => s as unknown as TSelected)) as Selector<TState, TSelected>;
    }, [selector]);

    const lastRef = React.useRef<TSelected | null>(null);
    const hasLast = React.useRef(false);

    const getSnapshot = React.useCallback(() => {
      const next = select(readable.getSnapshot());

      if (!hasLast.current) {
        hasLast.current = true;
        lastRef.current = next;
        return next;
      }

      const prev = lastRef.current as TSelected;
      if (equalityFn(prev, next)) return prev;

      lastRef.current = next;
      return next;
    }, [readable, select, equalityFn]);

    const subscribe = React.useCallback(
      (onChange: () => void) => readable.subscribe(onChange),
      [readable]
    );

    const getServerSnapshot = React.useCallback(() => {
      const s = readable.getServerSnapshot ? readable.getServerSnapshot() : readable.getSnapshot();
      return select(s);
    }, [readable, select]);

    React.useEffect(() => {
      hasLast.current = false;
      lastRef.current = null;
    }, [select, equalityFn]);

    return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  };

  /**
   * Creates a React-enhanced store.
   */
  const store = <T,>(storeKey: string, init: () => T): ReactBoundStore<T> => {
    const base = zuno.store<T>(storeKey, init);

    return {
      ...base,
      use: <TSelected = T>(
        selector?: Selector<T, TSelected>,
        equalityFn: EqualityFn<TSelected> = defaultEq
      ) => {
        const readable = React.useMemo(
          () => toReadable(base.raw() as ZunoSubscribableStore<T>),
          [storeKey]
        );
        return useExternalStore<T, TSelected>(readable, selector, equalityFn);
      },
    };
  };

  return {
    ...zuno,
    store,
  };
};

/**
 * Creates a Zuno instance and returns a React-enhanced instance.
 * 
 * @param opts The options for the Zuno instance.
 * @returns An object with a `store` method that returns stores with a `use` hook.
 */
export const createZunoReact = (opts: CreateZunoOptions) => {
  const zuno = createZuno(opts);
  return bindReact(zuno);
};

// Convenience re-export
export type { ZunoReadable } from "@iadev93/zuno";
