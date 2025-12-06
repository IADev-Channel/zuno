import { publishToStateEvent } from "../server/state.bus";
import { updateUniverseState } from "../server/universe-store";
import type { ZunoStateEvent } from "../sync/types";

/**
 * Core sync handler that applies an event to the universe
 * and broadcasts it to all SSE subscribers.
 * This is independent of HTTP / WebSocket / whatever transport.
 */
export const applyStateEvent = (event: ZunoStateEvent) => {
  updateUniverseState(event);
  publishToStateEvent(event);
};