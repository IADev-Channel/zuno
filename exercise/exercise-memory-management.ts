import { createUniverse } from "../core/universe";

const universe = createUniverse();
const value = 0;
const number = 1234567890;

const store = universe.getStore("counter", () => value);
const store2 = universe.getStore("number", () => number);
console.log("counter", store.get())
console.log("number", store2.get())
const unsubscribe = store.subscribe((state) => {
  console.log("counter", state);
});
const unsubscribe2 = store2.subscribe((state) => {
  console.log("number", state);
});
store.set((prev) => prev + 1);
store2.set((prev) => prev + 200);

store.set(2);
store2.set(987654320);

console.log(universe.snapshot())

universe.restore({
  counter: value,
  number: number
});
store.set(3);
store2.set(674533549382);

console.log(universe.snapshot())

unsubscribe()
unsubscribe2()

store.set(5);
store2.set(10000000000);

console.log(universe.snapshot())
