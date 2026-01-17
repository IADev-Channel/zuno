import express from "express";
import { createZunoExpress } from "@iadev93/zuno-express";
import { applyStateEvent } from "@iadev93/zuno/server";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const zuno = createZunoExpress();

app.get("/zuno/sse", zuno.sse);
app.get("/zuno/snapshot", zuno.snapshot);
app.post("/zuno/sync", zuno.sync);

app.get("/zuno/counter/:value", (req, res) => {
  const counterValue = Number(req.params.value);

  if (!Number.isFinite(counterValue)) {
    res.status(400).send("Invalid counter value");
    return;
  }

  const result = applyStateEvent({ storeKey: "counter", state: counterValue });

  res.status(200).json({ ok: true, event: result.ok ? result.event : null });
});

const PORT = 3003;
app.listen(PORT).addListener("listening", () => {
  console.log(`Server started on port ${PORT}`);
});