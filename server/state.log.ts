import type { ZunoStateEvent } from "../sync/types";

/** Maximum number of events to keep in the log. */
const MAX_EVENTS = 1000;

/** The next event id to assign. */
let nextEventId = 1

/** The log of events. */
const eventLog: ZunoStateEvent[] = []

/**
 * Appends an event to the log.
 * 
 * @param event The event to append.
 * @returns The appended event.
 */
export const appendEvent = (event: ZunoStateEvent) => {
  event.eventId = nextEventId++
  eventLog.push(event)

  if (eventLog.length > MAX_EVENTS) {
    eventLog.shift()
  }

  return event
}

/**
 * Returns events after the given event id.
 * 
 * @param lastEventId The last event id to return events after.
 * @returns The events after the given event id.
 */
export const getEventsAfter = (lastEventId: number) => {
  return eventLog.filter(event => (event?.eventId ?? 0) > lastEventId)
}