import type { ZunoStateEvent } from "./types";

/**
 * Options for starting a broadcast channel.
 */
export type ZunoBCOptions = {
  channelName: string;           // e.g. "zuno"
  clientId: string;              // unique per tab
  onEvent: (event: ZunoStateEvent) => void; // apply into universe/store
};

/**
 * Starts a broadcast channel for real-time state updates.
 * @param opts The options for the broadcast channel.
 * @returns An object with a `publish` method for publishing events and a `stop` method for stopping the channel.
 */
export const startBroadcastChannel = (opts: ZunoBCOptions) => {
  const bc = new BroadcastChannel(opts.channelName);

  /** 
   * Broadcash message event handler
  */
  const onMessage = (e: MessageEvent) => {
    const event = e.data as ZunoStateEvent | undefined;
    if (!event || typeof event !== "object") return;

    /** Ignore my own echoes */
    if (event.origin && event.origin === opts.clientId) return;

    opts.onEvent({ ...event, via: "bc" });
  };

  bc.addEventListener("message", onMessage);

  return {
    /** Publishes a state event to the broadcast channel. */
    publish: (event: ZunoStateEvent) => {
      bc.postMessage({ ...event, via: "bc", origin: opts.clientId });
    },
    /** Stops the broadcast channel. */
    stop: () => {
      bc.removeEventListener("message", onMessage);
      bc.close();
    },
  };
};