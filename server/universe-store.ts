import type { ZunoStateEvent } from "../sync/types";

/**
 * A global map to store the state of different parts of the universe.
 * The keys are `storeKey` strings and the values are the corresponding state objects.
 */
const universeState = new Map<string, any>();

/**
 * Updates the global universe state with a new event.
 * @param event The ZunoStateEvent containing the storeKey and the new state to set.
 */
export const updateUniverseState = (event: ZunoStateEvent) => {
  universeState.set(event.storeKey, event.state);
};

/**
 * Retrieves the current global universe state as a plain JavaScript object.
 * @returns An object where keys are storeKeys and values are their corresponding states.
 */
export const getUniverseState = () => {
  return Object.fromEntries(universeState);
};
