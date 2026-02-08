import {
	type ApplicationConfig,
	provideZoneChangeDetection,
} from "@angular/core";
import { provideZuno } from "@iadev93/zuno-angular";

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideZuno({
			// Assuming Express exercise is running on 3003
			syncUrl: "http://localhost:3003/zuno/sync",
			sseUrl: "http://localhost:3003/zuno/sse",
			channelName: "zuno-angular",
			clientId: `angular-client-${Math.random().toString(36).slice(2)}`,
		}),
	],
};
