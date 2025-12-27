import express from "express"
import { createZunoExpress } from "../adapters/express/createZunoExpress"
import cors from "cors"

const app = express()
app.use(express.json())
app.use(cors())



const zuno = createZunoExpress()

app.get("/zuno/sse", zuno.sse)
app.post("/zuno/sync", zuno.sync)

const PORT = 3000
app.listen(PORT).addListener("listening", () => {
  console.log(`Server started on port ${PORT}`)
})