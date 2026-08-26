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
	.post("/zuno/replay/:count/:operation?", ({ params, set }) => {
		const { count, operation = "increment" } = params;
		const eventCount = Number(count);
		if (!Number.isInteger(eventCount) || eventCount < 1 || eventCount > 100) {
			set.status = 400;
			return { ok: false, reason: "COUNT_MUST_BE_BETWEEN_1_AND_100" };
		}
		if (operation !== "increment" && operation !== "decrement") {
			set.status = 400;
			return { ok: false, reason: "OPERATION_MUST_BE_INCREMENT_OR_DECREMENT" };
		}

		const delta = operation === "increment" ? 1 : -1;

		const events = [];
		for (let index = 0; index < eventCount; index++) {
			const current = zuno.server.getUniverseRecord("counter") ?? {
				state: 0,
				version: 0,
			};
			const currentValue =
				typeof current.state === "number" ? current.state : 0;
			const result = applyStateEvent(
				{
					storeKey: "counter",
					state: currentValue + delta,
					baseVersion: current.version,
					origin: "replay-exercise",
				},
				zuno.server,
			);
			if (result.ok) events.push(result.event);
		}

		return {
			ok: true,
			operation,
			generated: events.length,
			firstEventId: events[0]?.eventId ?? null,
			lastEventId: events[events.length - 1]?.eventId ?? null,
			counter: zuno.server.getUniverseRecord("counter"),
		};
	})
	.get("/zuno/counter/:value", ({ params: { value } }) => {
		const counterValue = Number(value);

		if (!Number.isFinite(counterValue)) {
			return { ok: false, reason: "INVALID_VALUE" };
		}

		const result = applyStateEvent(
			{ storeKey: "counter", state: counterValue },
			zuno.server,
		);

		return { ok: true, event: result.ok ? result.event : null };
	})
	.listen(3002);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
