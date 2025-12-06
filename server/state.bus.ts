import type { ZunoStateEvent } from "../sync/types";
import type { ZunoStateListener } from "./types";

const listeners = new Set<ZunoStateListener>();

/**
 * Subscribes a listener function to state events.
 * The listener will be called whenever a new state event is published.
 *
 * @param listener The function to be called when a state event occurs.
 * @returns A cleanup function that, when called, unsubscribes the listener.
 */
export const subscribeToStateEvents = (listener: ZunoStateListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  }
}

/**
 * Publishes a state event to all registered listeners.
 * Each subscribed listener will receive the event.
 *
 * @param event The state event to be published.
 */
export const publishToStateEvent = (event: ZunoStateEvent) => {
  listeners.forEach(listener => listener(event));
}