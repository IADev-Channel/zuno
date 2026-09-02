import type { ZunoStateEvent } from "./index";

export type ZunoStateDelta = {
	type: "object";
	set: Record<string, unknown>;
	unset?: readonly string[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const applyZunoStateDelta = (
	current: unknown,
	delta: ZunoStateDelta,
): Record<string, unknown> => {
	const next = isObject(current) ? { ...current } : {};
	for (const key of delta.unset ?? []) delete next[key];
	Object.assign(next, delta.set);
	return next;
};

export const createZunoStateDelta = (
	current: unknown,
	next: unknown,
): ZunoStateDelta | undefined => {
	if (!isObject(current) || !isObject(next)) return undefined;
	const set: Record<string, unknown> = {};
	const unset: string[] = [];
	for (const [key, value] of Object.entries(next)) {
		if (JSON.stringify(current[key]) !== JSON.stringify(value))
			set[key] = value;
	}
	for (const key of Object.keys(current)) if (!(key in next)) unset.push(key);
	return { type: "object", set, ...(unset.length ? { unset } : {}) };
};

/** Uses a delta only when its serialized wire representation is smaller. */
export const optimizeZunoStateEvent = (
	event: ZunoStateEvent,
	current: unknown,
): ZunoStateEvent => {
	if (event.operation === "delete" || event.state === undefined) return event;
	const withoutRedundantSetIntent =
		event.intent?.type === "SET" ? { ...event, intent: undefined } : event;
	const delta = createZunoStateDelta(current, event.state);
	if (!delta) return withoutRedundantSetIntent;
	const fullBytes = JSON.stringify({ state: event.state }).length;
	const deltaBytes = JSON.stringify({ delta }).length;
	if (deltaBytes >= fullBytes) return withoutRedundantSetIntent;
	const { state: _state, ...rest } = withoutRedundantSetIntent;
	return { ...rest, delta };
};
