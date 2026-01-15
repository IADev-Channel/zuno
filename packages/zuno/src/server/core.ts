import type { ZunoStateEvent } from "../sync";

// --- Types ---

export type UniverseRecord = {
  state: any;
  version: number;
};

export type ZunoStateListener = (event: ZunoStateEvent) => void;

// --- State Store ---

const universeState = new Map<string, UniverseRecord>();

export const getUniverseRecord = (storeKey: string): UniverseRecord | undefined => {
  return universeState.get(storeKey);
};

export const updateUniverseState = (event: ZunoStateEvent) => {
  const current = universeState.get(event.storeKey) ?? { state: undefined, version: 0 };
  const nextVersion = typeof event.version === "number" ? event.version : current.version + 1;
  universeState.set(event.storeKey, { state: event.state, version: nextVersion });
};

export const getUniverseState = () => {
  return Object.fromEntries(universeState);
};

// --- Event Log ---

const MAX_EVENTS = 1000;
let nextEventId = 1;
const eventLog: ZunoStateEvent[] = [];

export const appendEvent = (event: ZunoStateEvent) => {
  event.eventId = nextEventId++;
  eventLog.push(event);
  if (eventLog.length > MAX_EVENTS) {
    eventLog.shift();
  }
  return event;
};

export const getEventsAfter = (lastEventId: number) => {
  return eventLog.filter((event) => (event?.eventId ?? 0) > lastEventId);
};

export const getLastEventId = () => {
  return eventLog[eventLog.length - 1]?.eventId ?? 0;
};

// --- State Bus (Events) ---

const listeners = new Set<ZunoStateListener>();

export const subscribeToStateEvents = (listener: ZunoStateListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const publishToStateEvent = (event: ZunoStateEvent) => {
  listeners.forEach((listener) => listener(event));
};
