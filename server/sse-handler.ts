import { publishToStateEvent, subscribeToStateEvents } from "./state.bus";

import type { ZunoStateEvent } from "../sync/types";
import type { IncomingMessage, ServerResponse } from "http";
import { getUniverseState } from "./universe-store";
import { applyStateEvent } from "../sync/sync-core";

type IncomingHeaders = IncomingMessage["headers"]

/**
 * Creates a Server-Sent Events (SSE) connection for Zuno state updates.
 *
 * This function sets up an SSE connection for clients to receive real-time updates
 * on the Zuno universe state. It sends connection status and then streams
 * any new `ZunoStateEvent`s as they are published.
 *
 * @param req The incoming HTTP request object.
 * @param res The server response object, used to establish and maintain the SSE connection.
 */
export const createSSEConnection = (req: IncomingMessage, res: ServerResponse, headers: IncomingHeaders) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...headers
  });

  // Subscribe to state events and send them to the client
  const unsubscribe = subscribeToStateEvents((event: ZunoStateEvent) => {
    const data = JSON.stringify(event);
    // res.write(`event: state\n`); // Event type for client-side filtering
    res.write(`data: ${data}\n\n`); // The actual event data
  });

  // Send an initial connection message
  res.write(": connected \n\n");

  // Clean up subscription when the client disconnects
  req.on("close", () => {
    unsubscribe();
  });
};

/**
 * Lists the current state of the Zuno universe.
 *
 * This function serves the entire universe state as a JSON object to any GET request.
 *
 * @param req The incoming HTTP request object.
 * @param res The server response object, used to send the JSON universe state.
 */
export const listUniverseState = (req: IncomingMessage, res: ServerResponse, headers: IncomingHeaders) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    ...headers
  });
  // Send the current state of the universe as a JSON string
  res.end(JSON.stringify(getUniverseState()));
};

/**
 * Synchronizes the Zuno universe state by applying an incoming event.
 *
 * This endpoint accepts a POST request with a JSON body representing a `ZunoStateEvent`.
 * It updates the universe state and then publishes the event to all SSE subscribers.
 *
 * @param req The incoming HTTP request object, expected to contain a JSON `ZunoStateEvent` in its body.
 * @param res The server response object, used to acknowledge the update or report errors.
 */
export const syncUniverseState = (req: IncomingMessage, res: ServerResponse) => {

  let body = "";
  // Accumulate data chunks from the request body
  req.on("data", (chunk: Buffer) => {
    body += chunk.toString();
  });

  // Process the complete request body
  req.on("end", () => {
    try {
      const event: ZunoStateEvent = JSON.parse(body);
      applyStateEvent(event); // ✅ core sync
      res.writeHead(200);
      res.end("ok"); // Acknowledge successful processing
    } catch (e) {
      // Handle cases where the request body is not valid JSON
      res.writeHead(400);
      res.end("Invalid JSON");
    }
  });
};