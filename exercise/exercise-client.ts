import { createUniverse } from "../core/universe";
import { startSSE } from "../sync/sse-client";
import { createHttpTransport } from "../sync/transport";

const universe = createUniverse();

const stop = startSSE({
  universe,
  url: "http://localhost:3000/zuno/sse",
});

// You can now subscribe to the local universe stores
const counterStore = universe.getStore("counter", () => (0));
const transport = createHttpTransport("http://localhost:3000/zuno/sync")
counterStore.subscribe((state) => {
  console.log("client counter:", state);
  transport.publish({ storeKey: "counter", state });
});

counterStore.set(Math.random())
// later:
// stop();