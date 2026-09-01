import { applyStateEvent, createZunoServerState } from "@iadev93/zuno/server";
import { createSQLiteZunoServerPersistence } from "@iadev93/zuno/server/sqlite";
import { createZunoExpress /*, mountZuno*/ } from "@iadev93/zuno-express";
import cors from "cors";
import express from "express";

const app = express();
app.use(express.json());
app.use(cors());

// --- Zuno Setup ---
const server = createZunoServerState({
	persistence: createSQLiteZunoServerPersistence("./.data/zuno.sqlite"),
});
const zuno = createZunoExpress({ server });

// Option 1: Granular control (Good for custom paths or middleware)
app.get("/zuno/sse", zuno.sse);
app.get("/zuno/snapshot", zuno.snapshot);
app.post("/zuno/sync", zuno.sync);

// Option 2: Shortcut helper
// zuno.mount(app);

app.get("/zuno/counter/:value", (req, res) => {
	const counterValue = Number(req.params.value);

	if (!Number.isFinite(counterValue)) {
		res.status(400).send("Invalid counter value");
		return;
	}

	const result = applyStateEvent(
		{ storeKey: "counter", state: counterValue },
		zuno.server,
	);

	res.status(200).json({ ok: true, event: result.ok ? result.event : null });
});

const PORT = 3003;
app.listen(PORT).addListener("listening", () => {
	console.log(`Server started on port ${PORT}`);
});
