import type { Request, Response } from "express"
import { sendSnapshot } from "../../server/snapshot-handler"

/**
 * Creates an Express handler for handling Zuno state events.
 * @returns An Express handler function.
 */
export function createExpressSnapshotHandler() {
  return (req: Request, res: Response) => sendSnapshot(req, res)
}
