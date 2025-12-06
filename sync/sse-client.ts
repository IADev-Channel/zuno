import type { ZunoSSEOptions, ZunoStateEvent } from "./types";

/**
 * Establishes a Server-Sent Events (SSE) connection to a server and
 * updates either a universe's store or a standalone store with received state events.
 *
 * @param options - Configuration options for the SSE connection.
 * @param options.url - The URL of the SSE endpoint.
 * @param [options.universe] - An optional universe instance to update.
 *                                  If provided, `eventState.storeKey` will be used to get the specific store.
 * @param [options.store] - An optional standalone store instance to update.
 *                               If `universe` is not provided, this store will be directly updated.
 *
 * @returns A cleanup function that removes the event listener and closes the EventSource.
 *
 * @throws {Error} If invalid options are provided (missing `url` or neither `universe` nor `store`).
 * @throws {Error} If a received message's data cannot be parsed as JSON.
 */
export const startSSE = (options: ZunoSSEOptions) => {
  if (!options || (!options.universe && !options.store) || !options.url) {
    throw new Error("Invalid options provided, must provide either 'universe' or 'store' and 'url'");
  }

  const eventSource = new EventSource(options.url);

  /**
   * Handles incoming Server-Sent Events messages.
   * Parses the event data and updates the appropriate store
   * (either within a universe or a standalone store).
   * @param event The MessageEvent received from the EventSource.
   */
  const listener = (event: MessageEvent) => {
    let eventState: ZunoStateEvent;

    try {
      eventState = JSON.parse(event.data);
    } catch (error) {
      throw new Error("Failed to parse state event");
    }

    if (options.universe) {
      options.universe.getStore(
        eventState.storeKey,
        () => eventState.state
      );
    } else if (options.store) {
      options.store.set(eventState.state);
    }
  };

  eventSource.addEventListener("state", listener);

  return () => {
    // Clean up: remove the state listener and close the SSE connection.
    eventSource.removeEventListener("state", listener);
    eventSource.close();
  };
};
