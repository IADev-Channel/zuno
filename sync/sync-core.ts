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
 * @property incoming - The incoming event to apply.
 * @returns The result of the application.
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
 * @property universe - The universe to apply the event to.
 * @property event - The event to apply.
 * @property ctx - The context for the event.
 **/
export function applyIncomingEvent(
  universe: Universe,
  event: ZunoStateEvent,
  ctx: IncomingEventContext
) {

  /** Prevent echo loops (don’t re-apply your own broadcast) */
  if (event.origin && event.origin === ctx.clientId) return;

  /** If versioned events exist (SSE/server/BC), ignore older ones */
  if (ctx.versions && typeof event.version === "number") {

    /** Check if the event has been seen */
    const seen = ctx.versions.has(event.storeKey);

    /** Get the current version */
    const currentVersion = ctx.versions.get(event.storeKey) ?? -1;

    /** If the event has been seen and the version is less than or equal to the current version, return */
    if (seen && event.version <= currentVersion) return;

    /** Set the version */
    ctx.versions.set(event.storeKey, event.version);
  }

  /** Apply to Universe store */
  const store = universe.getStore(event.storeKey, () => event.state);
  store.set(event.state);

  /** Optional local state cache (for BroadcastChannel snapshot) */
  ctx.localState?.set(event.storeKey, event.state);
}