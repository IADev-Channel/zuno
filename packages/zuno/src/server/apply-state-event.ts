import type { ZunoStateEvent } from "../sync";
import {
	appendEvent,
	getUniverseRecord,
	publishToStateEvent,
	updateUniverseState,
} from "./core";

export type ApplyResult =
	| { ok: true; event: ZunoStateEvent }
	| {
			ok: false;
			reason: "VERSION_CONFLICT";
			current: { state: unknown; version: number };
	  }
	| { ok: false; reason: string; current?: never };

/**
 * Validates and applies a state event to the server universe.
 */
export function applyStateEvent(incoming: ZunoStateEvent): ApplyResult {
	const current = getUniverseRecord(incoming.storeKey) ?? {
		state: undefined,
		version: 0,
	};

	// Strict version check
	if (
		typeof incoming.baseVersion === "number" &&
		incoming.baseVersion !== current.version
	) {
		return { ok: false, reason: "VERSION_CONFLICT", current };
	}

	// Increment version
	const nextVersion = current.version + 1;
	const event = { ...incoming, version: nextVersion };

	// Persistence
	updateUniverseState(event);
	appendEvent(event);

	// Notify SSE subscribers
	publishToStateEvent(event);

	return { ok: true, event };
}
