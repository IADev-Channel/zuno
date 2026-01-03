import type { IncomingEventContext, Universe } from "../core/types";
import type { ZunoStateEvent } from "./sync-types";
/**
 * Applies an incoming event to the Universe in a safe, reusable way.
 * @property universe - The universe to apply the event to.
 * @property event - The event to apply.
 * @property ctx - The context for the event.
 **/
export declare function applyIncomingEvent(universe: Universe, event: ZunoStateEvent, ctx: IncomingEventContext): void;
//# sourceMappingURL=apply-incoming-event.d.ts.map