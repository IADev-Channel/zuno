import { createZuno } from "@iadev93/zuno";
import { createZunoServerState } from "@iadev93/zuno/server";
import { ZunoService } from "@iadev93/zuno-angular";
import { createZunoElysia } from "@iadev93/zuno-elysia";
import { createZunoExpress } from "@iadev93/zuno-express";
import { createZunoReact } from "@iadev93/zuno-react";

const exportsToCheck = [
	createZuno,
	createZunoServerState,
	createZunoReact,
	createZunoExpress,
	createZunoElysia,
	ZunoService,
];

if (exportsToCheck.some((value) => typeof value !== "function")) {
	throw new Error("An ESM package export is missing");
}

console.log("ESM packed-package consumer passed");
