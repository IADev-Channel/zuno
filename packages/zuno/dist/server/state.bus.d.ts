import type { ZunoStateEvent } from "../sync/sync-types";
import type { ZunoStateListener } from "./types";
/**
 * Subscribes a listener function to state events.
 * The listener will be called whenever a new state event is published.
 *
 * @param listener The function to be called when a state event occurs.
 * @returns A cleanup function that, when called, unsubscribes the listener.
 */
export declare const subscribeToStateEvents: (listener: ZunoStateListener) => () => void;
/**
 * Publishes a state event to all registered listeners.
 * Each subscribed listener will receive the event.
 *
 * @param event The state event to be published.
 */
export declare const publishToStateEvent: (event: ZunoStateEvent) => void;
//# sourceMappingURL=state.bus.d.ts.map