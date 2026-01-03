import type { ZunoStateEvent } from "../sync/sync-types";
/**
 * Appends an event to the log.
 *
 * @param event The event to append.
 * @returns The appended event.
 */
export declare const appendEvent: (event: ZunoStateEvent) => ZunoStateEvent;
/**
 * Returns events after the given event id.
 *
 * @param lastEventId The last event id to return events after.
 * @returns The events after the given event id.
 */
export declare const getEventsAfter: (lastEventId: number) => ZunoStateEvent[];
/**
 * Returns the last event id in the log.
 *
 * @returns The last event id in the log.
 */
export declare const getLastEventId: () => number;
//# sourceMappingURL=state.log.d.ts.map