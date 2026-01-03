import type { Request, Response } from "express"
import { sendSnapshot } from "@iadev/zuno/server"

/**
 * Creates an Express handler for handling Zuno state events.
 * @returns An Express handler function.
 */
export function createExpressSnapshotHandler() {
  return (req: Request, res: Response) => sendSnapshot(req, res)
}
