import { Elysia } from "elysia";
import { createZunoElysia } from "@iadev93/zuno-elysia";
import cors from "@elysiajs/cors";

const zuno = createZunoElysia();

const app = new Elysia()
  .use(cors({ origin: "*" }))
  .get("/", () => "Hello Elysia")
  .get("/zuno/sse", zuno.sse)
  .post("/zuno/sync", zuno.sync)
  .get("/zuno/snapshot", zuno.snapshot)
  .get("/zuno/counter/increment", () => {
     // This is just a dummy to show it works, in a real app you'd use Zuno logic
     return { ok: true }
  })
  .listen(3002);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
