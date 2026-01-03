/**
 * The set of listeners subscribed to state events.
 */
const listeners = new Set();
/**
 * Subscribes a listener function to state events.
 * The listener will be called whenever a new state event is published.
 *
 * @param listener The function to be called when a state event occurs.
 * @returns A cleanup function that, when called, unsubscribes the listener.
 */
export const subscribeToStateEvents = (listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
/**
 * Publishes a state event to all registered listeners.
 * Each subscribed listener will receive the event.
 *
 * @param event The state event to be published.
 */
export const publishToStateEvent = (event) => {
    listeners.forEach(listener => listener(event));
};
