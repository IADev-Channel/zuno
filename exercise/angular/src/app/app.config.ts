import {
	type ApplicationConfig,
	provideZoneChangeDetection,
} from "@angular/core";
import { createIndexedDBOfflineQueue } from "@iadev93/zuno";
import { provideZuno } from "@iadev93/zuno-angular";
import { ZUNO_SERVER_URL } from "../../../config";

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideZuno({
			// Share the server selected in exercise/config.ts.
			syncUrl: `${ZUNO_SERVER_URL}/zuno/sync`,
			sseUrl: `${ZUNO_SERVER_URL}/zuno/sse`,
			channelName: "zuno-demo",
			clientId: `angular-client-${Math.random().toString(36).slice(2)}`,
			offlineQueue: createIndexedDBOfflineQueue({
				databaseName: "zuno-exercises",
				queueKey: "angular",
			}),
		}),
	],
};
