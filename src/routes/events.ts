import express from "express"
import { EventsService } from "../api/events-service"

export const eventsRouter = express.Router()

// GET /api/events - Get all events
eventsRouter.get("/", async (req, res) => {
  try {
    const events = await EventsService.readEvents()
    res.json({ success: true, data: events })
  } catch (error) {
    console.error("Failed to load events:", error)
    res.status(500).json({ success: false, error: "Failed to load events" })
  }
})

// POST /api/events - Create a new event
eventsRouter.post("/", async (req, res) => {
  try {
    const { dateKey, event } = req.body

    if (!dateKey || !event) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: dateKey and event"
      })
    }

    const newEvent = await EventsService.addEvent(dateKey, event)
    res.json({ success: true, data: newEvent })
  } catch (error) {
    console.error("Failed to create event:", error)
    res.status(500).json({ success: false, error: "Failed to create event" })
  }
})

// PUT /api/events/:dateKey/:eventId - Update an event
eventsRouter.put("/:dateKey/:eventId", async (req, res) => {
  try {
    const { dateKey, eventId } = req.params
    const updatedEventData = req.body

    const updatedEvent = await EventsService.updateEvent(
      dateKey,
      eventId,
      updatedEventData
    )

    if (!updatedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" })
    }

    res.json({ success: true, data: updatedEvent })
  } catch (error) {
    console.error("Failed to update event:", error)
    res.status(500).json({ success: false, error: "Failed to update event" })
  }
})

// DELETE /api/events/:dateKey/:eventId - Delete an event
eventsRouter.delete("/:dateKey/:eventId", async (req, res) => {
  try {
    const { dateKey, eventId } = req.params

    const deleted = await EventsService.deleteEvent(dateKey, eventId)

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Event not found" })
    }

    res.json({ success: true })
  } catch (error) {
    console.error("Failed to delete event:", error)
    res.status(500).json({ success: false, error: "Failed to delete event" })
  }
})
