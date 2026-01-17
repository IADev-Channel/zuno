/** Universal UI adapter contract */
export type ZunoReadable<T> = {
	/** Read current value (sync) */
	getSnapshot(): T;

	/**
	 * Subscribe to changes.
	 * Call `onChange()` whenever snapshot may have changed.
	 * Return unsubscribe.
	 */
	subscribe(onChange: () => void): () => void;

	/** Optional: React SSR (server snapshot) */
	getServerSnapshot?: () => T;
};

/** Minimal store shape that can be adapted into a readable */
export type ZunoSubscribableStore<T> = {
	get(): T;
	subscribe(cb: (state: T) => void): () => void;
};

/** Adapter helper: convert store => readable */
export function toReadable<T>(
	store: ZunoSubscribableStore<T>,
): ZunoReadable<T> {
	return {
		getSnapshot: () => store.get(),
		subscribe: (onChange) => store.subscribe(() => onChange()),
	};
}
