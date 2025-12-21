import type { ZunoStateEvent } from "../sync/sync-types";

/**
 * A global map to store the state of different parts of the universe.
 * The keys are `storeKey` strings and the values are the corresponding state objects.
 */
type UniverseRecord = {
  state: any;
  version: number;
};

const universeState = new Map<string, UniverseRecord>();

/**
 * Retrieves the current state of a specific store in the universe.
 * @param storeKey The key of the store to retrieve.
 * @returns The current state of the store, or undefined if the store does not exist.
 */
export const getUniverseRecord = (storeKey: string): UniverseRecord | undefined => {
  return universeState.get(storeKey);
};

/**
 * Updates the state of a specific store in the universe.
 * @param event The ZunoStateEvent containing the storeKey and the new state to set.
 */
export const updateUniverseState = (event: ZunoStateEvent) => {
  const current = universeState.get(event.storeKey) ?? { state: undefined, version: 0 };

  // If applyStateEvent already computed event.version, prefer it.
  const nextVersion =
    typeof event.version === "number" ? event.version : current.version + 1;

  universeState.set(event.storeKey, { state: event.state, version: nextVersion });
};

/**
 * Retrieves the current state of the entire universe.
 * @returns An object containing the state of all stores in the universe.
 */
export const getUniverseState = () => {
  return Object.fromEntries(universeState);
};
