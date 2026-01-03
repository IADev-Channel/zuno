import { createStore } from "./store";
/**
 * Creates a ZUNO Universe.
 *
 * A Universe is a simple container that manages multiple named stores.
 * It:
 * - Lazily creates a store when `getStore` is called with a new key
 * - Can snapshot the state of all known stores
 * - Can restore state from a snapshot
 */
export const createUniverse = () => {
    const stores = new Map();
    return {
        getStore(key, init) {
            if (!stores.has(key)) {
                const initialState = init();
                stores.set(key, createStore(initialState));
            }
            // TypeScript doesn't know the concrete T stored under this key,
            // but by convention you control init(), so this cast is safe.
            return stores.get(key);
        },
        snapshot() {
            const out = {};
            for (const [key, store] of stores.entries()) {
                out[key] = store.get();
            }
            return out;
        },
        restore(data) {
            for (const [key, value] of Object.entries(data)) {
                const existing = stores.get(key);
                if (existing) {
                    existing.set(value);
                }
                else {
                    // create a new store with this initial value
                    const newStore = createStore(value);
                    stores.set(key, newStore);
                }
            }
        },
        delete(key) {
            stores.delete(key);
        },
        clear() {
            stores.clear();
        },
        hydrateSnapshot(snapshot) {
            this.restore(snapshot.state);
        }
    };
};
