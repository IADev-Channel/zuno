/**
 * Performs a shallow equality check between two values.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;

	if (
		typeof a !== "object" ||
		a === null ||
		typeof b !== "object" ||
		b === null
	) {
		return false;
	}

	const keysA = Object.keys(a as object);
	const keysB = Object.keys(b as object);

	if (keysA.length !== keysB.length) return false;

	const objA = a as Record<string, unknown>;
	const objB = b as Record<string, unknown>;

	for (const key of keysA) {
		if (!Object.hasOwn(objB, key) || !Object.is(objA[key], objB[key])) {
			return false;
		}
	}

	return true;
}
