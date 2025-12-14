/**
 * @file This script demonstrates the core functionalities of a state management system,
 * including creating a universe, defining and interacting with stores, subscribing to state changes,
 * taking snapshots of the universe state, and restoring the universe to a previous state.
 * It showcases basic memory management operations for state objects.
 */
import { createUniverse } from "../core/universe";

const universe = createUniverse();
const value = 0;
const number = 1234567890;

/**
 * Initializes a store named "counter" with an initial value.
 * @type {Store<number>}
 */
const store = universe.getStore("counter", () => value);
/**
 * Initializes a store named "number" with an initial value.
 * @type {Store<number>}
 */
const store2 = universe.getStore("number", () => number);

console.log("counter", store.get())
console.log("number", store2.get())

/**
 * Subscribes to changes in the "counter" store and logs the new state.
 * @type {function(): void}
 */
const unsubscribe = store.subscribe((state) => {
  console.log("counter", state);
});
/**
 * Subscribes to changes in the "number" store and logs the new state.
 * @type {function(): void}
 */
const unsubscribe2 = store2.subscribe((state) => {
  console.log("number", state);
});

// Update store values using a functional updater
store.set((prev) => prev + 1);
store2.set((prev) => prev + 200);

// Update store values directly
store.set(2);
store2.set(987654320);

// Log the current snapshot of the universe state
console.log(universe.snapshot())

// Restore the universe to a predefined state
universe.restore({
  counter: value,
  number: number
});

// Update store values after restoration
store.set(3);
store2.set(674533549382);

// Log the snapshot after restoration and further updates
console.log(universe.snapshot())

// Unsubscribe from store changes to prevent further logging
unsubscribe()
unsubscribe2()

// Update store values after unsubscribing (these changes won't be logged by the previous subscriptions)
store.set(5);
store2.set(10000000000);

// Log the final snapshot of the universe state
console.log(universe.snapshot())
