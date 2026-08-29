import {
	type ApplicationConfig,
	provideZoneChangeDetection,
} from "@angular/core";
import { createIndexedDBOfflineQueue } from "@iadev93/zuno";
import { provideZuno } from "@iadev93/zuno-angular";

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideZuno({
			// Share the Elysia universe used by the React and HTML examples.
			syncUrl: "http://localhost:3002/zuno/sync",
			sseUrl: "http://localhost:3002/zuno/sse",
			channelName: "zuno-demo",
			clientId: `angular-client-${Math.random().toString(36).slice(2)}`,
			offlineQueue: createIndexedDBOfflineQueue({
				databaseName: "zuno-exercises",
				queueKey: "angular",
			}),
		}),
	],
};
