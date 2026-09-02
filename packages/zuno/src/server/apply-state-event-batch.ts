import type { ZunoStateEvent, ZunoSubscriptionPrincipal } from "../sync";
import { type ApplyResult, applyStateEvent } from "./apply-state-event";
import { defaultZunoServerState, type ZunoServerState } from "./core";

export type ZunoMutationBatch = { events: readonly ZunoStateEvent[] };
export type ZunoMutationBatchResult = {
	ok: boolean;
	results: ApplyResult[];
	conflictIndex?: number;
};

export const isZunoMutationBatch = (
	input: unknown,
): input is ZunoMutationBatch =>
	typeof input === "object" &&
	input !== null &&
	Array.isArray((input as { events?: unknown }).events);

/** Applies an ordered HTTP batch and stops before the first rejected mutation. */
export const applyStateEventBatch = (
	batch: ZunoMutationBatch,
	server: ZunoServerState = defaultZunoServerState,
	principal?: ZunoSubscriptionPrincipal,
): ZunoMutationBatchResult => {
	const results: ApplyResult[] = [];
	for (const [index, event] of batch.events.entries()) {
		const result = applyStateEvent(event, server, principal);
		results.push(result);
		if (!result.ok) return { ok: false, results, conflictIndex: index };
	}
	return { ok: true, results };
};
