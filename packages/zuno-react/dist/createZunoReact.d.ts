import { CreateZunoOptions } from "@iadev/zuno";
/**
 * Creates a Zuno instance and returns a React hook for accessing the store.
 *
 * ⚠️ IMPORTANT:
 *
 * Call this at **module scope**, not inside *React components*.
 * This creates a single Zuno instance.
 *
 * @param opts The options for the Zuno instance.
 * @returns An object with a `useStore` hook for accessing the store.
 */
export declare const createZunoReact: (opts: CreateZunoOptions) => {
    store: <T>(storeKey: string, init: () => T) => {
        key: string;
        get: () => T;
        set: (next: T | ((prev: T) => T)) => Promise<any>;
        subscribe: (cb: (state: T) => void) => () => void;
        raw: () => import("@iadev/zuno").ZunoSubscribableStore<T>;
    } & {
        use: <TSelected = T>(selector?: ((state: T) => TSelected) | undefined, equalityFn?: ((a: TSelected, b: TSelected) => boolean) | undefined) => TSelected;
    };
    set<T>(storeKey: string, next: T | ((prev: T) => T), init?: () => T): Promise<any>;
    get<T>(storeKey: string, init?: () => T): T;
    stop?: () => void;
};
//# sourceMappingURL=createZunoReact.d.ts.map