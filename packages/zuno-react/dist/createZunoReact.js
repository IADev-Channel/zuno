"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createZunoReact = void 0;
const zuno_1 = require("@iadev/zuno");
const bindReact_1 = require("./bindReact");
/**
 * Creates a Zuno instance and returns a React hook for accessing the store.
 *
 * ⚠️ IMPORTANT:
 *
 * Call this at **module scope**, not inside *React components*.
 * This creates a single Zuno instance.
 *
 * @param opts The options for the Zuno instance.
 * @returns An object with a `useStore` hook for accessing the store.
 */
const createZunoReact = (opts) => {
    /** Zuno */
    const zuno = (0, zuno_1.createZuno)(opts);
    /** Return zuno */
    return (0, bindReact_1.bindReact)(zuno);
};
exports.createZunoReact = createZunoReact;
