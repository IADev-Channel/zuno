import { publishToStateEvent } from "./state.bus";
import { appendEvent } from "./state.log";
import { getUniverseRecord, updateUniverseState } from "./universe-store";
/**
 * Core sync handler that applies an event to the universe
 * and broadcasts it to all SSE subscribers.
 * This is independent of HTTP / WebSocket / whatever transport.
 * @property {ZunoStateEvent} incoming - The incoming event to apply.
 * @returns {ApplyResult} The result of the application.
 */
export const applyStateEvent = (incoming) => {
    /** Get the current state of the store */
    const current = getUniverseRecord(incoming.storeKey) ?? { state: undefined, version: 0 };
    /** Only enforce if client provided baseVersion */
    if (typeof incoming.baseVersion === "number" && incoming.baseVersion !== current.version) {
        return { ok: false, reason: "VERSION_CONFLICT", current };
    }
    /** Create a new event with the next version and current timestamp */
    const event = appendEvent({
        ...incoming,
        version: current.version + 1,
        ts: Date.now(),
    });
    /** Update the universe state */
    updateUniverseState(event);
    /** Publish the event */
    publishToStateEvent(event);
    return { ok: true, event };
};
