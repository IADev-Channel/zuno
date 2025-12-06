import { subscribeToStateEvents } from "./state.bus";
import type { ZunoStateEvent } from "../sync/types";
import type { IncomingMessage, ServerResponse } from "http";

export const handleZunoSSE = (req: IncomingMessage, res: ServerResponse) => {
  const { method } = req;
  if (method !== "GET") return

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const unsubscribe = subscribeToStateEvents((event: ZunoStateEvent) => {
    const data = JSON.stringify(event);
    res.write(`event: state\n`);
    res.write(`data: ${data}\n\n`);
  });

  res.write(": connected \n\n");

  req.on("close", () => {
    console.log("Client disconnected");
    unsubscribe();
  });

};