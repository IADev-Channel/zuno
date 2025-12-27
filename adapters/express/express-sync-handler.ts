import type { Request, Response } from "express"
import type { ZunoStateEvent } from "../../sync/sync-types"

import { applyStateEvent } from "../../server/apply-state-event"

/**
 * Creates an Express handler for handling Zuno state events.
 * @returns An Express handler function.
 */
export function createExpressSyncHandler() {
  return (req: Request, res: Response) => {
    /** The incoming state event to apply. */
    const incoming = req.body as ZunoStateEvent

    /** Applies the incoming state event to the target Zuno universe or store. */
    const result = applyStateEvent(incoming)

    /** If the state event is not valid, returns a 409 status code with the reason and current state. */
    if (!result.ok) {
      res.status(409).json({
        reason: result.reason,
        current: result.current,
      })
      return
    }

    /** Returns a 200 status code with the result. */
    res.status(200).json({ ok: true, event: result.event })
  }
}