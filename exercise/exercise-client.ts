import { createUniverse } from "../core/universe";
import { startSSE } from "../sync/sse-client";

const initiate = () => {
  const counterEl = document.getElementById("count") as HTMLSpanElement;
  const inc = document.getElementById("increment") as HTMLButtonElement;
  const dec = document.getElementById("decrement") as HTMLButtonElement;

  const universe = createUniverse();
  let counterStore = universe.getStore<number>("counter", () => 0);

  const { unsubscribe, dispatch } = startSSE({
    universe,
    url: "http://localhost:3000/zuno/sse",
    syncUrl: "http://localhost:3000/zuno/sync",
    optimistic: true, // set false if you want authoritative server mode
    channelName: "zuno-demo", // enable multi tab sync if provided
    getSnapshot: () => {
      // after snapshot applied, store already contains server value
      counterEl.textContent = String(counterStore.get());
    },
  });

  counterStore.subscribe((v) => {
    counterEl.textContent = String(v);
  });

  inc.addEventListener("click", () => {
    dispatch({ storeKey: "counter", state: counterStore.get() + 1 });
  });

  dec.addEventListener("click", () => {
    dispatch({ storeKey: "counter", state: counterStore.get() - 1 });
  });

  // later: unsubscribe();
};

initiate();
