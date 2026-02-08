import {
	type EnvironmentProviders,
	InjectionToken,
	inject,
	makeEnvironmentProviders,
	type Signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
	type BoundStore,
	type CreateZunoOptions,
	createZuno,
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

// --- Service ---
// Note: We use the function-based DI pattern or Injectable.
// Biome suggested removing Injectable if not used as a decorator, but it IS used.

/**
 * ZunoService provides access to Zuno stores in Angular.
 */
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

		const asObservable = () =>
			new Observable<T>((subscriber) => {
				subscriber.next(baseStore.get());
				const sub = baseStore.subscribe((state) => {
					subscriber.next(state);
				});
				return () => sub();
			}).pipe(distinctUntilChanged(baseStore.equals));

		const asSignal = () => {
			return toSignal(asObservable(), { initialValue: baseStore.get() });
		};

		return {
			...baseStore,
			asObservable,
			asSignal,
		};
	}

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
