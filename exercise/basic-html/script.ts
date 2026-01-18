import { createZuno } from "@iadev93/zuno";

/**
 * Initiate Zuno
 */
const initiate = () => {
	/** Counter element */
	const counterEl = document.getElementById("count") as HTMLSpanElement;

	/** Increment button */
	const inc = document.getElementById("increment") as HTMLButtonElement;

	/** Decrement button */
	const dec = document.getElementById("decrement") as HTMLButtonElement;

	/** Create Zuno */
	const zuno = createZuno({
		/** Channel name (for mutiple tabs sync broadcast channel) */
		channelName: "zuno-demo",

		/** SSE URL (for server sync - real-time updates) */
		sseUrl: "http://localhost:3002/zuno/sse",

		/** Sync URL (for client sync - state updates) */
		syncUrl: "http://localhost:3002/zuno/sync",

		/** Optimistic (for optimistic updates - local updates before server confirmation) */
		optimistic: true,

		/** Middleware (for intercepting and logging events) */
		middleware: [
			(_api) => (next) => async (event) => {
				console.log(`[Zuno] Dispatching ${event.storeKey}:`, event.state);
				const res = await next(event);
				console.log(`[Zuno] Result for ${event.storeKey}:`, res);
				return res;
			},
		],

		/** Conflict resolver (Highest number wins strategy) */
		resolveConflict: (local, server, key) => {
			console.warn(`[Zuno] Conflict detected on ${key}!`);
			if (typeof local === "number" && typeof server === "number") {
				return Math.max(local, server);
			}
			return server; // Fallback to server state
		},
	});

	/** Counter store */
	const counter = zuno.store<number>("counter", () => 0);

	/** Set counter element */
	counterEl.textContent = String(counter.get());

	/** Counter subscription */
	counter.subscribe((counterValue) => {
		counterEl.textContent = String(counterValue);
	});

	/** Increment button click handler */
	inc.addEventListener("click", () => {
		counter.set((prev: number) => prev + 1);
	});

	/** Decrement button click handler */
	dec.addEventListener("click", () => {
		counter.set((prev: number) => prev - 1);
	});
};

initiate();
