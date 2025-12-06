import { applyStateEvent } from "../sync/sync-core";
import type { ZunoStateEvent } from "../sync/types";

/**
 * Creates an in-memory transport for publishing Zuno state events.
 * Events published through this transport are immediately applied to the local state
 * without any network communication.
 * @returns An object with a `publish` method.
 */
export const createInMemoryTransport = () => {
  return {
    /**
     * Publishes a Zuno state event.
     * The event is immediately processed and applied to the current state.
     * @param event The Zuno state event to publish.
     */
    publish(event: ZunoStateEvent) {
      applyStateEvent(event);
    },
  };
};