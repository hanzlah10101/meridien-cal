import express from "express"
import path from "path"
import fs from "fs/promises"

// Exportable Express app so it can run in Vercel Functions (no .listen there)
const app = express()
export default app

// Middleware
app.use(express.json())
// Use project root as base to resolve assets when running on Vercel
const ROOT_DIR = process.cwd()
app.use(express.static(ROOT_DIR))

// Path to events JSON file
// On Vercel, the filesystem is read-only; only /tmp is writable per invocation.
const DATA_DIR = process.env.VERCEL ? "/tmp" : ROOT_DIR
const EVENTS_FILE = path.join(DATA_DIR, "events.json")

// Helper function to read events
async function readEvents() {
  try {
  const data = await fs.readFile(EVENTS_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    // If file doesn't exist, return empty object
    return {}
  }
}

// Helper function to write events
async function writeEvents(events: any) {
  try {
    await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2))
  } catch (err) {
    console.error("Failed to write events file", err)
    throw err
  }
}

// API Routes
app.get("/api/events", async (req, res) => {
  try {
    const events = await readEvents()
    res.json({ success: true, data: events })
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to load events" })
  }
})

app.post("/api/events", async (req, res) => {
  try {
    const { dateKey, event } = req.body
    const events = await readEvents()

    if (!events[dateKey]) {
      events[dateKey] = []
    }

    // Add ID to event
    event.id = Date.now() + Math.random()
    events[dateKey].push(event)

    await writeEvents(events)
    res.json({ success: true, data: event })
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create event" })
  }
})

app.put("/api/events/:dateKey/:eventId", async (req, res) => {
  try {
    const { dateKey, eventId } = req.params
    const updatedEvent = req.body
    const events = await readEvents()

    if (!events[dateKey]) {
      return res.status(404).json({ success: false, error: "Date not found" })
    }

    const eventIndex = events[dateKey].findIndex((e: any) => e.id == eventId)
    if (eventIndex === -1) {
      return res.status(404).json({ success: false, error: "Event not found" })
    }

    // Keep the original ID
    updatedEvent.id = events[dateKey][eventIndex].id
    events[dateKey][eventIndex] = updatedEvent

    await writeEvents(events)
    res.json({ success: true, data: updatedEvent })
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update event" })
  }
})

app.delete("/api/events/:dateKey/:eventId", async (req, res) => {
  try {
    const { dateKey, eventId } = req.params
    const events = await readEvents()

    if (!events[dateKey]) {
      return res.status(404).json({ success: false, error: "Date not found" })
    }

    const eventIndex = events[dateKey].findIndex((e: any) => e.id == eventId)
    if (eventIndex === -1) {
      return res.status(404).json({ success: false, error: "Event not found" })
    }

    events[dateKey].splice(eventIndex, 1)

    // Remove date key if no events left
    if (events[dateKey].length === 0) {
      delete events[dateKey]
    }

    await writeEvents(events)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete event" })
  }
})

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "Hotels.html"))
})

// Only start a server when running locally. On Vercel, this file is imported by an API route.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`)
  })
}
