const { createZuno } = require("@iadev93/zuno");
const { createZunoServerState } = require("@iadev93/zuno/server");
const { createZunoReact } = require("@iadev93/zuno-react");
const { createZunoExpress } = require("@iadev93/zuno-express");
const { createZunoElysia } = require("@iadev93/zuno-elysia");

const exportsToCheck = [
	createZuno,
	createZunoServerState,
	createZunoReact,
	createZunoExpress,
	createZunoElysia,
];

if (exportsToCheck.some((value) => typeof value !== "function")) {
	throw new Error("A CommonJS package export is missing");
}

// Angular and its runtime are ESM-only. A CommonJS application consumes it
// through the standard dynamic-import bridge.
import("@iadev93/zuno-angular").then(({ ZunoService }) => {
	if (typeof ZunoService !== "function") {
		throw new Error("The Angular package export is missing");
	}
	console.log("CommonJS packed-package consumer passed");
});
