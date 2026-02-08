import type { Middleware } from "@iadev93/zuno";

export const loggerMiddleware: Middleware =
	(api) => (next) => async (event) => {
		console.groupCollapsed(`[Zuno] Action: ${event.storeKey}`);
		console.log(
			"Prev State:",
			api.universe.getStore(event.storeKey, () => null).get(),
		);

		if (event.intent) {
			const hasPayload =
				event.intent.payload !== undefined && event.intent.payload !== null;
			const payloadStr = hasPayload
				? ` ${JSON.stringify(event.intent.payload)}`
				: "";
			console.log(`[Zuno] Intent: ${event.intent.type}${payloadStr}`);
		} else {
			console.log("Direct Set State:", event.state);
		}

		const result = await next(event);

		console.log(
			"Next State:",
			api.universe.getStore(event.storeKey, () => null).get(),
		);
		console.log("Result:", result);
		console.groupEnd();

		return result;
	};
