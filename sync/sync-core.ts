import { publishToStateEvent } from "../server/state.bus";
import { getUniverseRecord, updateUniverseState } from "../server/universe-store";
import { appendEvent } from "../server/state.log";

import type { ZunoStateEvent } from "../sync/types";

/**
 * Result of applying a state event.
 * If the event was applied successfully, `ok` is true and `event` contains the applied event.
 * If there was a version conflict, `ok` is false and `reason` is "VERSION_CONFLICT".
 */
export type ApplyResult =
  | { ok: true; event: ZunoStateEvent }
  | { ok: false; reason: "VERSION_CONFLICT"; current: { state: any; version: number } };

/**
 * Core sync handler that applies an event to the universe
 * and broadcasts it to all SSE subscribers.
 * This is independent of HTTP / WebSocket / whatever transport.
 */
export const applyStateEvent = (incoming: ZunoStateEvent): ApplyResult => {

  // Get the current state of the store.
  const current = getUniverseRecord(incoming.storeKey) ?? { state: undefined, version: 0 };

  // Only enforce if client provided baseVersion
  if (typeof incoming.baseVersion === "number" && incoming.baseVersion !== current.version) {
    return { ok: false, reason: "VERSION_CONFLICT", current };
  }

  // Create a new event with the next version and current timestamp.
  const event: ZunoStateEvent = appendEvent({
    ...incoming,
    version: current.version + 1,
    ts: Date.now(),
  });

  updateUniverseState(event);
  publishToStateEvent(event);

  return { ok: true, event };
};