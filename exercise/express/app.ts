import express from "express"
import { createZunoExpress } from "@iadev93/zuno-express"
import cors from "cors"

const app = express()
app.use(express.json())
app.use(cors())



const zuno = createZunoExpress()

app.get("/zuno/sse", zuno.sse)
app.get("/zuno/snapshot", zuno.snapshot)
app.post("/zuno/sync", zuno.sync)

const PORT = 3000
app.listen(PORT).addListener("listening", () => {
  console.log(`Server started on port ${PORT}`)
})