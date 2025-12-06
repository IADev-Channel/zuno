import type { ZunoStateEvent, ZunoStateListener } from "./types";

const listeners = new Set<ZunoStateListener>();

export const subscribeToStateEvents = (listener: ZunoStateListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  }
}

export const publishToStateEvent = (event: ZunoStateEvent) => {
  listeners.forEach(listener => listener(event));
}