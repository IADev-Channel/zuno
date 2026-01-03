/** Adapter helper: convert store => readable */
export function toReadable(store) {
    return {
        getSnapshot: () => store.get(),
        subscribe: (onChange) => store.subscribe(() => onChange()),
    };
}
