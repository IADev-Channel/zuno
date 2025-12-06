import type { ZunoStateEvent } from "../sync/types";

/**
 * A callback function type for listening to Zuno state events.
 *
 * @param event The Zuno state event that occurred.
 */
export type ZunoStateListener = (event: ZunoStateEvent) => void;
