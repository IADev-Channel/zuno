import { subscribeToStateEvents } from "./state.bus";

import type { ZunoStateEvent } from "../sync/types";
import type { IncomingMessage, ServerResponse } from "http";
import { getUniverseState } from "./universe-store";
import { applyStateEvent } from "../sync/sync-core";
import { getEventsAfter } from "./state.log";

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
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream; charset=utf-8",
    Connection: "keep-alive",
    ...headers
  });

  /**
   * Immediately flushes the response headers to the client.
   * This is crucial for SSE to ensure the client receives headers and
   * starts processing the event stream without buffering delays.
   */
  res.flushHeaders?.();

  /** Get the last event id from header `last-evend-id` */
  const lastEventId = Number(req.headers["last-event-id"] ?? 0);

  /**
   * If the client has a `last-event-id`, it means it's reconnecting after a disconnect.
   * In this case, we need to send it any missed events since the last event it received.
   */
  if (lastEventId > 0) {
    /** Get the events that occurred after the last event the client received. */
    const missed = getEventsAfter(lastEventId);

    /** Send the missed events to the client. */
    for (const event of missed) {
      res.write(`id: ${event.eventId}\n`);
      res.write(`event: state\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }
  /**
   * If the client doesn't have a `last-event-id`, it means it's a fresh connection.
   * In this case, we need to send it the current state of the universe.
   */
  else {
    /** Send the current state of the universe to the client. */
    res.write(`event: snapshot\n`);
    res.write(`data: ${JSON.stringify(getUniverseState())}\n\n`);
  }

  /** Subscribe to state events and send them to the client */
  const unsubscribe = subscribeToStateEvents((event: ZunoStateEvent) => {
    res.write(`id: ${event.eventId}\n`);
    res.write(`event: state\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`); // The actual event data
  });

  /**
   * Set up a heartbeat mechanism to keep the SSE connection alive.
   * A ping event is sent every 15 seconds.
   */
  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  /**
   * Send an initial connection message to the client.
   * This helps the client know when the connection is established.
   */
  res.write(": connected \n\n");

  /**
   * Clean up subscription when the client disconnects.
   */
  req.on("close", () => {
    clearInterval(heartbeat);
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
 * @param transport The transport object used to publish the event to all SSE subscribers.
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