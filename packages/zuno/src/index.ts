export * from "./core";

export { 
  createZuno, 
  createUniverse, 
  createStore 
} from "./core";

export type { 
  CreateZunoOptions, 
  Universe, 
  Store, 
  BoundStore, 
  ZunoSnapshot 
} from "./core";

export { 
  startSSE, 
  startBroadcastChannel, 
  applyIncomingEvent 
} from "./sync";

export type { 
  ZunoStateEvent, 
  TransportStatus, 
  ZunoTransport 
} from "./sync";

/**
 * Shared adapter contract (public)
 * Helps others build UI bindings like @iadev93/zuno-react.
 */
export type { ZunoReadable, ZunoSubscribableStore } from "./shared/readable";
export { toReadable } from "./shared/readable";
