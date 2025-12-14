import { createZuno, CreateZunoOptions } from "../../core/createZuno";
import { bindReact } from "./bindReact";

/**
 * Creates a Zuno instance and returns a React hook for accessing the store.
 * @param opts The options for the Zuno instance.
 * @returns An object with a `useStore` hook for accessing the store.
 */
export const createZunoReact = (ots: CreateZunoOptions) => {

  /** Zuno */
  const zuno = createZuno(ots)

  /** Return zuno */
  return bindReact(zuno)
};