import type { Store, Universe } from "../core/types";

export interface ZunoStateEvent {
  storeKey: string;
  state: unknown;
}

export type ZunoSSEOptions =
  | { url: string; universe: Universe; store?: never }
  | { url: string; store: Store<any>; universe?: never };
