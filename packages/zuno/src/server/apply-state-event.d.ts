import type { ZunoStateEvent } from "../sync/sync-types";
/**
 * Result of applying a state event.
 * If the event was applied successfully, `ok` is true and `event` contains the applied event.
 * If there was a version conflict, `ok` is false and `reason` is "VERSION_CONFLICT".
 */
export type ApplyResult = {
    ok: true;
    event: ZunoStateEvent;
} | {
    ok: false;
    reason: "VERSION_CONFLICT";
    current: {
        state: any;
        version: number;
    };
};
/**
 * Core sync handler that applies an event to the universe
 * and broadcasts it to all SSE subscribers.
 * This is independent of HTTP / WebSocket / whatever transport.
 * @property {ZunoStateEvent} incoming - The incoming event to apply.
 * @returns {ApplyResult} The result of the application.
 */
export declare const applyStateEvent: (incoming: ZunoStateEvent) => ApplyResult;
//# sourceMappingURL=apply-state-event.d.ts.map