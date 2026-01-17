import cors from "@elysiajs/cors";
import { applyStateEvent } from "@iadev93/zuno/server";
import { createZunoElysia } from "@iadev93/zuno-elysia";
import { Elysia } from "elysia";

const zuno = createZunoElysia();

const app = new Elysia()
	.use(cors({ origin: "*" }))
	.get("/", () => "Hello Elysia")
	.get("/zuno/sse", zuno.sse)
	.post("/zuno/sync", zuno.sync)
	.get("/zuno/snapshot", zuno.snapshot)
	.get("/zuno/counter/:value", ({ params: { value } }) => {
		const counterValue = Number(value);

		if (!Number.isFinite(counterValue)) {
			return { ok: false, reason: "INVALID_VALUE" };
		}

		const result = applyStateEvent({
			storeKey: "counter",
			state: counterValue,
		});

		return { ok: true, event: result.ok ? result.event : null };
	})
	.listen(3002);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
