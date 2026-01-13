import type { ZunoStateEvent } from "@iadev93/zuno";
import {
  applyStateEvent,
  getEventsAfter,
  getLastEventId,
  getUniverseState,
  subscribeToStateEvents,
} from "@iadev93/zuno/server";
import { sse as elysiaSSE } from "elysia"

/**
 * Creates a Zuno Elysia instance.
 * @returns {Object} An object with the following properties:
 *   - sse: An async generator function that handles SSE connections for Elysia.
 *     @property {Object} set - Elysia response object.
 *     @property {Object} headers - Elysia request headers.
 *     @property {Object} query - Elysia request query parameters.
 *   - sync: A function that handles sync POST requests for Elysia.
 *     @property {Object} body - Elysia request body.
 *     @property {Object} set - Elysia response object.
 *   - snapshot: A function that handles snapshot GET requests for Elysia.
 */
export function createZunoElysia() {
  return {
    /**
     * Handles SSE connections for Elysia using an async generator.
     * @param {Object} param - Elysia request object.
     * @param {Object} param.set - Elysia response object.
     * @param {Object} param.headers - Elysia request headers.
     * @param {Object} param.query - Elysia request query parameters.
     */
    sse: async function* ({ set, headers, query }: any) {
      set.headers["Content-Type"] = "text/event-stream";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Connection"] = "keep-alive";

      yield elysiaSSE(": connected\n");
      yield elysiaSSE(":" + " ".repeat(2048) + "\n\n"); // Padding to bypass browser buffering

      // Get last event id
      const rawLastEventId = headers["last-event-id"] || query?.lastEventId;
      const lastEventId = Number.parseInt(rawLastEventId || "0", 10) || 0;

      if (lastEventId > 0) {
        const missed = getEventsAfter(lastEventId);
        for (const event of missed) {
          yield elysiaSSE(`id: ${event.eventId}\nevent: state\ndata: ${JSON.stringify(event)}\n\n`);
        }
      } else {
        const snapshot = getUniverseState();
        yield elysiaSSE(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      }

      // Buffer queue for events
      const queue: string[] = [];
      let resolve: ((value: void | PromiseLike<void>) => void) | null = null;

      // Subscribe to events
      const unsubscribe = subscribeToStateEvents((event: ZunoStateEvent) => {
        queue.push(`id: ${event.eventId}\nevent: state\ndata: ${JSON.stringify(event)}\n\n`);
        if (resolve) {
          resolve();
          resolve = null;
        }
      });

      // Heartbeat interval
      const heartbeat = setInterval(() => {
        queue.push(`: ping ${Date.now()}\n\n`);
        if (resolve) {
          resolve();
          resolve = null;
        }
      }, 15000);

      try {
        while (true) {
          if (queue.length === 0) {
            await new Promise<void>((r) => {
              resolve = r;
            });
          }

          while (queue.length > 0) {
            yield queue.shift()!;
          }
        }
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    },

    /**
     * Handles sync POST requests for Elysia.
     * @param {Object} param - Elysia request object.
     * @param {Object} param.body - Elysia request body.
     * @param {Object} param.set - Elysia response object.
     * @returns {Object} An object with the following properties:
     *   - ok: A boolean indicating whether the sync was successful.
     *   - event: The event that was applied to the universe.
     */
    sync: ({ body, set }: any) => {
      const incoming = body as ZunoStateEvent;
      const result = applyStateEvent(incoming);

      if (!result.ok) {
        set.status = 409;
        return {
          ok: false,
          reason: result.reason,
          current: result.current,
        };
      }

      return { ok: true, event: result.event };
    },

    /**
     * Handles snapshot GET requests for Elysia.
     * @returns {Object} An object with the following properties:
     *   - state: The current state of the universe.
     *   - version: The version of the universe.
     *   - lastEventId: The ID of the last event in the universe.
     */
    snapshot: () => {
      return {
        state: getUniverseState(),
        version: (getUniverseState() as any).version ?? 0,
        lastEventId: getLastEventId(),
      };
    },
  };
}
