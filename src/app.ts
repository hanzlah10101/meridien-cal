// Setup module aliases for production builds
// alias disabled in production builds

import express from "express"
import dotenv from "dotenv"
import path from "path"
import { eventsRouter } from "./routes/events"
import { FileSystemUtils } from "./utils/file-system"
import { authMiddleware, checkAuthStatus } from "./middleware/auth"

// Load env vars in local/dev
dotenv.config()

// Exportable Express app so it can run in Vercel Functions (no .listen there)
const app = express()
export default app

// Middleware
app.use(express.json())

// Serve assets at /assets route to match deployment paths
app.use("/assets", express.static(FileSystemUtils.getPublicPath()))

// API Routes - Protected with authentication
app.use("/api/events", authMiddleware, eventsRouter)

// Serve the login page
app.get("/login", (_, res) => {
  // Always serve login page - let frontend handle auth state
  const htmlPath = path.join(FileSystemUtils.getPublicPath(), "login.html")
  res.sendFile(htmlPath)
})

// Serve the events calendar (protected route)
app.get("/events", async (req, res) => {
  try {
    const isAuthenticated = await checkAuthStatus(req)

    if (!isAuthenticated) {
      // User is not authenticated, redirect to login
      res.redirect("/login")
      return
    }

    // User is authenticated, serve the events calendar
    const htmlPath = path.join(FileSystemUtils.getPublicPath(), "events.html")
    res.sendFile(htmlPath)
  } catch (error) {
    console.error("Error checking auth status:", error)
    // On error, redirect to login
    res.redirect("/login")
  }
})

// Default route - redirect to events (frontend will handle auth)
app.get("/", (_, res) => {
  res.redirect("/events")
})

// Only start a server when running locally. On Vercel, this file is imported by an API route.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`)
  })
}
