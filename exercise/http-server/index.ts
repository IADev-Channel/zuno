import http from "node:http";
import {
	applyStateEvent,
	createSSEConnection,
	createZunoServerState,
	sendSnapshot,
	setUniverseState,
} from "@iadev93/zuno/server";
import { createSQLiteZunoServerPersistence } from "@iadev93/zuno/server/sqlite";
import { EXERCISE_SERVER_PORTS } from "../config";

const zunoServer = createZunoServerState({
	persistence: createSQLiteZunoServerPersistence("./.data/zuno.sqlite"),
});

const server = http.createServer((req, res) => {
	// CORS Headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.url === "/zuno/sse") {
		createSSEConnection(
			req,
			res,
			{ "Access-Control-Allow-Origin": "*" },
			zunoServer,
		);
	}
	// Optional for listing internally
	else if (req.url === "/zuno/listing" && req.method === "GET") {
		sendSnapshot(req, res, zunoServer);
	} else if (req.url === "/zuno/sync" && req.method === "POST") {
		setUniverseState(req, res, zunoServer);
	} else if (req.url?.startsWith("/zuno/counter/") && req.method === "GET") {
		const counter = req.url.split("/").pop();
		const counterValue = Number(counter);

		if (!Number.isFinite(counterValue)) {
			res.writeHead(400);
			res.end("Invalid counter value");
			return;
		}

		const result = applyStateEvent(
			{ storeKey: "counter", state: counterValue },
			zunoServer,
		);

		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({ ok: true, event: result.ok ? result.event : null }),
		);
	} else {
		res.writeHead(404);
		res.end("Not found");
	}
});

server.listen(EXERCISE_SERVER_PORTS.http, () => {
	console.log(`SSE server on http://localhost:${EXERCISE_SERVER_PORTS.http}`);
});
