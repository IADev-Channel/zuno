const universeState = new Map();
/**
 * Retrieves the current state of a specific store in the universe.
 * @param storeKey The key of the store to retrieve.
 * @returns The current state of the store, or undefined if the store does not exist.
 */
export const getUniverseRecord = (storeKey) => {
    return universeState.get(storeKey);
};
/**
 * Updates the state of a specific store in the universe.
 * @param event The ZunoStateEvent containing the storeKey and the new state to set.
 */
export const updateUniverseState = (event) => {
    const current = universeState.get(event.storeKey) ?? { state: undefined, version: 0 };
    // If applyStateEvent already computed event.version, prefer it.
    const nextVersion = typeof event.version === "number" ? event.version : current.version + 1;
    universeState.set(event.storeKey, { state: event.state, version: nextVersion });
};
/**
 * Retrieves the current state of the entire universe.
 * @returns An object containing the state of all stores in the universe.
 */
export const getUniverseState = () => {
    return Object.fromEntries(universeState);
};
