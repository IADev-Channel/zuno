import type { Universe } from "./types";
/**
 * Creates a ZUNO Universe.
 *
 * A Universe is a simple container that manages multiple named stores.
 * It:
 * - Lazily creates a store when `getStore` is called with a new key
 * - Can snapshot the state of all known stores
 * - Can restore state from a snapshot
 */
export declare const createUniverse: () => Universe;
//# sourceMappingURL=universe.d.ts.map