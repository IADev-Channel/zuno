import { createZuno, CreateZunoOptions } from "@iadev93/zuno";
import { bindReact } from "./bindReact";

/**
 * Creates a Zuno instance and returns a React hook for accessing the store.
 * 
 * ⚠️ IMPORTANT:
 * 
 * Call this at **module scope**, not inside *React components*.
 * This creates a single Zuno instance.
 * 
 * @param opts The options for the Zuno instance.
 * @returns An object with a `useStore` hook for accessing the store.
 */
export const createZunoReact = (opts: CreateZunoOptions) => {

  /** Zuno */
  const zuno = createZuno(opts)

  /** Return zuno */
  return bindReact(zuno)
};