import { publishToStateEvent } from "../server/state.bus";
import { getUniverseRecord, updateUniverseState } from "../server/universe-store";
import { appendEvent } from "../server/state.log";

import type { ZunoStateEvent } from "./sync-types";
import type { IncomingEventContext, Universe } from "../core/types";

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

/**
 * Applies an incoming event to the Universe in a safe, reusable way.
 * - ignores self events (origin === clientId)
 * - ignores older versions if event.version is present
 * - updates universe store state
 * - updates localState (optional)
 */
export function applyIncomingEvent(
  universe: Universe,
  event: ZunoStateEvent,
  ctx: IncomingEventContext
) {

  /** Prevent echo loops (don’t re-apply your own broadcast) */
  if (event.origin && event.origin === ctx.clientId) return;

  /** If versioned events exist (SSE/server), ignore older ones */
  if (ctx.versions && typeof event.version === "number") {
    const currentVersion = ctx.versions.get(event.storeKey) ?? 0;
    if (event.version <= currentVersion) return;
    ctx.versions.set(event.storeKey, event.version);
  }

  /** Apply to Universe store */
  const store = universe.getStore(event.storeKey, () => event.state);
  store.set(event.state);

  /** Optional local state cache (for BroadcastChannel snapshot) */
  ctx.localState?.set(event.storeKey, event.state);
}