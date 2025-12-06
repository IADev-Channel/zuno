import type { Universe, Store } from "./types";
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
export const createUniverse = (): Universe => {
  const stores = new Map<string, Store<any>>();

  return {
    /**
     * Retrieves a store by key. If the store does not exist yet,
     * it is created using the provided `init` function.
     */
    getStore<T>(key: string, init: () => T): Store<T> {
      if (!stores.has(key)) {
        const initialState = init();
        stores.set(key, createStore(initialState));
      }

      // TypeScript doesn't know the concrete T stored under this key,
      // but by convention you control init(), so this cast is safe.
      return stores.get(key)! as Store<T>;
    },

    /**
     * Takes a snapshot of the current state of all stores.
     * The snapshot is a plain object: { [key]: state }.
     */
    snapshot(): Record<string, unknown> {
      const out: Record<string, unknown> = {};

      for (const [key, store] of stores.entries()) {
        out[key] = store.get();
      }

      return out;
    },

    /**
     * Restores store states from a snapshot object.
     * - If a store already exists, its state is updated via `set`.
     * - If a store does not exist yet, a new store is created with that value.
     */
    restore(data: Record<string, unknown>): void {
      for (const [key, value] of Object.entries(data)) {
        const existing = stores.get(key);

        if (existing) {
          existing.set(value as any);
        } else {
          // create a new store with this initial value
          const newStore = createStore(value as any);
          stores.set(key, newStore);
        }
      }
    },

    /**
     * Deletes a store by its unique key.
     * @param key The unique identifier for the store to delete.
     */
    delete(key: string): void {
      stores.delete(key);
    },

    /**
     * Clears all stores from the Universe.
     */
    clear(): void {
      stores.clear();
    },
  };
};
