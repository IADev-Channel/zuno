import type { ZunoStateEvent } from "../sync";
import { parseScopedStoreKey, type ZunoSubscriptionPrincipal } from "../sync";
import { defaultZunoServerState, type ZunoServerState } from "./core";

export type EventValidationError = { field: string; message: string };
export type ApplyResult =
	| { ok: true; event: ZunoStateEvent }
	| {
			ok: false;
			reason: "VERSION_CONFLICT";
			current: { state: unknown; version: number };
			errors?: never;
	  }
	| {
			ok: false;
			reason: "INVALID_EVENT" | "FORBIDDEN_SCOPE";
			errors: EventValidationError[];
			current?: never;
	  };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export function validateStateEvent(
	input: unknown,
	maxStateBytes = 512 * 1024,
): EventValidationError[] {
	if (!isRecord(input))
		return [{ field: "event", message: "Event must be an object" }];
	const errors: EventValidationError[] = [];
	if (
		typeof input.storeKey !== "string" ||
		input.storeKey.trim().length === 0 ||
		input.storeKey.length > 256
	)
		errors.push({
			field: "storeKey",
			message: "storeKey must be a non-empty string of at most 256 characters",
		});
	if (!("state" in input))
		errors.push({ field: "state", message: "state is required" });
	else
		try {
			const serialized = JSON.stringify(input.state);
			if (serialized === undefined)
				errors.push({
					field: "state",
					message: "state must be JSON-serializable",
				});
			else if (new TextEncoder().encode(serialized).byteLength > maxStateBytes)
				errors.push({
					field: "state",
					message: `state exceeds the ${maxStateBytes} byte limit`,
				});
		} catch {
			errors.push({
				field: "state",
				message: "state must be JSON-serializable",
			});
		}
	for (const field of ["version", "baseVersion", "eventId"] as const) {
		const value = input[field];
		if (
			value !== undefined &&
			(!Number.isInteger(value) || (value as number) < 0)
		)
			errors.push({
				field,
				message: `${field} must be a non-negative integer when provided`,
			});
	}
	if (input.origin !== undefined && typeof input.origin !== "string")
		errors.push({
			field: "origin",
			message: "origin must be a string when provided",
		});
	if (input.ts !== undefined && !Number.isFinite(input.ts))
		errors.push({
			field: "ts",
			message: "ts must be a finite number when provided",
		});
	if (
		input.intent !== undefined &&
		(!isRecord(input.intent) ||
			typeof input.intent.type !== "string" ||
			input.intent.type.trim().length === 0)
	)
		errors.push({
			field: "intent",
			message: "intent must contain a non-empty string type",
		});
	return errors;
}

export function authorizeStateEvent(
	incoming: ZunoStateEvent,
	principal: ZunoSubscriptionPrincipal,
): EventValidationError[] {
	const scope = parseScopedStoreKey(incoming.storeKey);
	if (!scope)
		return [
			{
				field: "storeKey",
				message: "subscription-aware mutations require partition:topic:key",
			},
		];
	if (!principal.partitions.includes(scope.partition))
		return [
			{ field: "storeKey", message: "principal cannot access this partition" },
		];
	if (!principal.topics.includes(scope.topic))
		return [
			{ field: "storeKey", message: "principal cannot access this topic" },
		];
	return [];
}

export function applyStateEvent(
	incoming: unknown,
	server: ZunoServerState = defaultZunoServerState,
	principal?: ZunoSubscriptionPrincipal,
): ApplyResult {
	const errors = validateStateEvent(incoming, server.maxStateBytes);
	if (errors.length > 0) return { ok: false, reason: "INVALID_EVENT", errors };
	if (principal) {
		const authorizationErrors = authorizeStateEvent(
			incoming as ZunoStateEvent,
			principal,
		);
		if (authorizationErrors.length > 0)
			return {
				ok: false,
				reason: "FORBIDDEN_SCOPE",
				errors: authorizationErrors,
			};
	}
	const result = server.compareAndSet(incoming as ZunoStateEvent);
	if (!result.ok)
		return { ok: false, reason: "VERSION_CONFLICT", current: result.current };
	server.publishToStateEvent(result.event);
	return { ok: true, event: result.event };
}
