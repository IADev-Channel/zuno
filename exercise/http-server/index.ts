import http from "http";
import { createSSEConnection, syncUniverseState } from "@iadev93/zuno";
import { applyStateEvent } from "@iadev93/zuno";
import { sendSnapshot } from "@iadev93/zuno";

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
    createSSEConnection(req, res, {
      "Access-Control-Allow-Origin": "*"
    });
  }
  // Optional for listing internally
  else if (req.url === "/zuno/listing" && req.method === "GET") {
    sendSnapshot(req, res);
  } else if (req.url === "/zuno/sync" && req.method === "POST") {
    syncUniverseState(req, res);
  } else if (req.url?.startsWith("/zuno/counter/") && req.method === "GET") {
    const counter = req.url.split("/").pop();
    const counterValue = Number(counter);

    if (!Number.isFinite(counterValue)) {
      res.writeHead(400);
      res.end("Invalid counter value");
      return;
    }

    const result = applyStateEvent({ storeKey: "counter", state: counterValue });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, event: result.ok ? result.event : null }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(3000, () => {
  console.log("SSE server on http://localhost:3000");
});
