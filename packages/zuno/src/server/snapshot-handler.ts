import type { IncomingMessage, ServerResponse } from "http";
import { getUniverseState, getLastEventId } from "./core";

/**
 * Sends a snapshot of the current universe state to the response.
 * Compatible with both Express and raw Node.js http.
 */
export function sendSnapshot(_req: IncomingMessage, res: ServerResponse) {
  const snapshot = {
    state: getUniverseState(),
    lastEventId: getLastEventId(),
  };

  // Check for Express-like .json() method
  if ("json" in res && typeof (res as any).json === "function") {
    (res as any).json(snapshot);
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot));
  }
}
