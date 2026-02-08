/**
 * Performs a shallow equality check between two values.
 */
export function shallowEqual(a: any, b: any): boolean {
	if (Object.is(a, b)) return true;

	if (
		typeof a !== "object" ||
		a === null ||
		typeof b !== "object" ||
		b === null
	) {
		return false;
	}

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);

	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (!Object.hasOwn(b, key) || !Object.is(a[key], b[key])) {
			return false;
		}
	}

	return true;
}
