/**
 * Applies an incoming event to the Universe in a safe, reusable way.
 * @property universe - The universe to apply the event to.
 * @property event - The event to apply.
 * @property ctx - The context for the event.
 **/
export function applyIncomingEvent(universe, event, ctx) {
    /** Prevent echo loops (don’t re-apply your own broadcast) */
    if (event.origin && event.origin === ctx.clientId)
        return;
    /** If versioned events exist (SSE/server/BC), ignore older ones */
    if (ctx.versions && typeof event.version === "number") {
        /** Check if the event has been seen */
        const seen = ctx.versions.has(event.storeKey);
        /** Get the current version */
        const currentVersion = ctx.versions.get(event.storeKey) ?? -1;
        /** If the event has been seen and the version is less than or equal to the current version, return */
        if (seen && event.version <= currentVersion)
            return;
        /** Set the version */
        ctx.versions.set(event.storeKey, event.version);
    }
    /** Apply to Universe store */
    const store = universe.getStore(event.storeKey, () => event.state);
    store.set(event.state);
    /** Optional local state cache (for BroadcastChannel snapshot) */
    ctx.localState?.set(event.storeKey, event.state);
}
