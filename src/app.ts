// Setup module aliases for production builds
// alias disabled in production builds

import express from "express"
import dotenv from "dotenv"
import path from "path"
import { eventsRouter } from "./routes/events"
import { FileSystemUtils } from "./utils/file-system"

// Load env vars in local/dev
dotenv.config()

// Exportable Express app so it can run in Vercel Functions (no .listen there)
const app = express()
export default app

// Middleware
app.use(express.json())

// Use project root as base to resolve assets when running on Vercel
app.use(express.static(FileSystemUtils.getPublicPath()))

// API Routes
app.use("/api/events", eventsRouter)

// Serve the main HTML file
app.get("/", (req, res) => {
  const htmlPath = path.join(FileSystemUtils.getPublicPath(), "events.html")
  res.sendFile(htmlPath)
})

// Only start a server when running locally. On Vercel, this file is imported by an API route.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`)
  })
}
