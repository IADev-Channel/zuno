import { getUniverseState } from "./universe-store";
import { getLastEventId } from "./state.log";
/**
 * Sends a snapshot of the universe state to the client.
 *
 * @param _req The incoming HTTP request object.
 * @param res The server response object, used to send the JSON universe state.
 */
export function sendSnapshot(_req, res) {
    const body = {
        state: getUniverseState(),
        version: getUniverseState().version ?? 0,
        lastEventId: getLastEventId(),
    };
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
}
