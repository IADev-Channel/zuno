import type { Middleware } from "@iadev93/zuno";

export const loggerMiddleware: Middleware =
	(api) => (next) => async (event) => {
		console.groupCollapsed(`[Zuno] Action: ${event.storeKey}`);
		console.log(
			"Prev State:",
			api.universe.getStore(event.storeKey, () => null).get(),
		);
		console.log("Event:", event);

		const result = await next(event);

		console.log(
			"Next State:",
			api.universe.getStore(event.storeKey, () => null).get(),
		);
		console.log("Result:", result);
		console.groupEnd();

		return result;
	};
