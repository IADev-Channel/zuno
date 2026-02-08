import {
	DestroyRef,
	type EnvironmentProviders,
	Injectable,
	InjectionToken,
	inject,
	makeEnvironmentProviders,
	type Signal,
	signal,
	type WritableSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
	type BoundStore,
	type CreateZunoOptions,
	createZuno,
	type Store,
	type ZunoSnapshot,
	type ZunoSubscribableStore,
} from "@iadev93/zuno";
import { distinctUntilChanged, Observable } from "rxjs";

export const ZUNO_OPTIONS = new InjectionToken<CreateZunoOptions>(
	"ZUNO_OPTIONS",
);

/**
 * An Angular-enhanced Zuno store.
 */
export type AngularBoundStore<T> = BoundStore<T> & {
	/**
	 * Returns the store state as an RxJS Observable.
	 * The Observable emits distinct values based on the store's equality check.
	 */
	asObservable: () => Observable<T>;

	/**
	 * Returns the store state as an Angular Signal.
	 * WARNING: Must be called within an injection context (e.g. constructor)
	 * so that cleanup can be handled automatically.
	 */
	asSignal: () => Signal<T>;
};

@Injectable({ providedIn: "root" })
export class ZunoService {
	private zuno;

	constructor() {
		const options = inject(ZUNO_OPTIONS, { optional: true }) || {};
		this.zuno = createZuno(options);
	}

	/**
	 * Create or retrieve a Zuno store with Angular bindings.
	 */
	store<T>(
		key: string,
		init: () => T,
		reducer?: (prev: T, intent: unknown) => T,
		equals?: (v1: unknown, v2: unknown) => boolean,
	): AngularBoundStore<T> {
		const baseStore = this.zuno.store(key, init, reducer, equals);

		// Cache observable creation if possible?
		// For now, create fresh to avoid persistent subscription leaks if not careful.
		// Actually, we can just create a helper.

		const asObservable = () =>
			new Observable<T>((subscriber) => {
				subscriber.next(baseStore.get());
				const sub = baseStore.subscribe((state) => {
					subscriber.next(state);
				});
				return () => sub();
			}).pipe(
				// Use the store's equality function for distinctUntilChanged
				distinctUntilChanged(baseStore.equals),
			);

		const asSignal = () => {
			// toSignal requires an injection context.
			// We pass the observable to toSignal.
			// requireSync: true because Zuno stores are synchronous.
			return toSignal(asObservable(), { initialValue: baseStore.get() });
		};

		return {
			...baseStore,
			asObservable,
			asSignal,
		};
	}

	// --- Proxy Core Methods ---

	get<T>(key: string, init?: () => T): T {
		return this.zuno.get(key, init);
	}

	set<T>(key: string, next: T | ((prev: T) => T), init?: () => T) {
		return this.zuno.set(key, next, init);
	}

	mutate(key: string, intent: { type: string; payload?: unknown }) {
		return this.zuno.mutate(key, intent);
	}

	snapshot() {
		return this.zuno.universe.snapshot();
	}
}

/**
 * Configures Zuno for the application.
 * Usage: provideZuno({ ...options }) in app.config.ts
 */
export function provideZuno(
	options: CreateZunoOptions = {},
): EnvironmentProviders {
	return makeEnvironmentProviders([
		{ provide: ZUNO_OPTIONS, useValue: options },
		ZunoService,
	]);
}

// Re-export core types
export * from "@iadev93/zuno";
