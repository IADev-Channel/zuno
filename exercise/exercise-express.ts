import express from "express"
import { createZunoExpress } from "../adapters/express/createZunoExpress"
import { createServerTransport } from "../server/server-transport"
import cors from "cors"

const app = express()
app.use(express.json())
app.use(cors())


const transport = createServerTransport()

const zuno = createZunoExpress({ transport })

app.get("/zuno/sse", zuno.sse)
app.post("/zuno/sync", zuno.sync)

const PORT = 3000
app.listen(PORT).addListener("listening", () => {
  console.log(`Server started on port ${PORT}`)
})