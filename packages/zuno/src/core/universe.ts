import type { Universe, Store, ZunoSnapshot } from "./types";
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

    getStore<T>(key: string, init: () => T): Store<T> {
      if (!stores.has(key)) {
        const initialState = init();
        stores.set(key, createStore(initialState));
      }

      // TypeScript doesn't know the concrete T stored under this key,
      // but by convention you control init(), so this cast is safe.
      return stores.get(key)! as Store<T>;
    },

    snapshot(): Record<string, unknown> {
      const out: Record<string, unknown> = {};

      for (const [key, store] of stores.entries()) {
        out[key] = store.get();
      }

      return out;
    },

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

    delete(key: string): void {
      stores.delete(key);
    },

    clear(): void {
      stores.clear();
    },

    hydrateSnapshot(snapshot: ZunoSnapshot) {
      this.restore(snapshot.state)
    }
  };
};
