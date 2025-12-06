import type { ZunoSSEOptions, ZunoStateEvent } from "./types";

export const startZunoSSE = (options: ZunoSSEOptions) => {
  if (!options.universe && !options.store) {
    console.warn(
      "[Zuno SSE] No 'universe' or 'store' provided – incoming state will be ignored."
    );
  }

  const eventSource = new EventSource(options.url);

  const listener = (event: MessageEvent) => {
    let eventState: ZunoStateEvent;

    try {
      eventState = JSON.parse(event.data);
    } catch (error) {
      console.error("Failed to parse state event:", error);
      return;
    }

    if (options.universe) {
      const store = options.universe.getStore<any>(
        eventState.storeKey,
        () => eventState.state
      );
      store.set(eventState.state as any);
    } else if (options.store) {
      options.store.set(eventState.state as any);
    }
  };

  eventSource.addEventListener("state", listener);

  return () => {
    eventSource.removeEventListener("state", listener);
    eventSource.close();
  };
};
