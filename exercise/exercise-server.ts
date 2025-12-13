import http from "http";
import { createSSEConnection, listUniverseState, syncUniverseState } from "../server/sse-handler";
import { createInMemoryTransport } from "../server/inmemory-transport";

const transport = createInMemoryTransport();

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
    listUniverseState(req, res, {
      "Access-Control-Allow-Origin": "*"
    });
  } else if (req.url === "/zuno/sync" && req.method === "POST") {
    syncUniverseState(req, res);
  } else if (req.url?.includes("/zuno/counter") && req.method === "GET") {
    const counter = req.url?.split("/")?.pop();
    if (counter) {
      const counterValue = parseInt(counter);
      if (isNaN(counterValue)) {
        res.writeHead(400);
        res.end("Invalid counter value");
        return;
      }
      transport.publish({ storeKey: "counter", state: counterValue });
      res.writeHead(200);
      res.end("Counter updated");
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(3000, () => {
  console.log("SSE server on http://localhost:3000");
});
