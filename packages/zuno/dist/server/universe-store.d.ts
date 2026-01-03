import type { ZunoStateEvent } from "../sync/sync-types";
/**
 * A global map to store the state of different parts of the universe.
 * The keys are `storeKey` strings and the values are the corresponding state objects.
 */
type UniverseRecord = {
    state: any;
    version: number;
};
/**
 * Retrieves the current state of a specific store in the universe.
 * @param storeKey The key of the store to retrieve.
 * @returns The current state of the store, or undefined if the store does not exist.
 */
export declare const getUniverseRecord: (storeKey: string) => UniverseRecord | undefined;
/**
 * Updates the state of a specific store in the universe.
 * @param event The ZunoStateEvent containing the storeKey and the new state to set.
 */
export declare const updateUniverseState: (event: ZunoStateEvent) => void;
/**
 * Retrieves the current state of the entire universe.
 * @returns An object containing the state of all stores in the universe.
 */
export declare const getUniverseState: () => {
    [k: string]: UniverseRecord;
};
export {};
//# sourceMappingURL=universe-store.d.ts.map