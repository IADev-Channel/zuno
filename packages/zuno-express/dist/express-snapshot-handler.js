import { sendSnapshot } from "@iadev/zuno";
/**
 * Creates an Express handler for handling Zuno state events.
 * @returns An Express handler function.
 */
export function createExpressSnapshotHandler() {
    return (req, res) => sendSnapshot(req, res);
}
