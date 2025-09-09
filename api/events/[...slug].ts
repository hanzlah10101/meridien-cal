import type { VercelRequest, VercelResponse } from "@vercel/node"
import { EventsService } from "../../src/api/events-service"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  )
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  )

  if (req.method === "OPTIONS") {
    res.status(200).end()
    return
  }

  // Extract dateKey and eventId from the query parameters
  const { slug } = req.query

  if (!Array.isArray(slug) || slug.length !== 2) {
    return res.status(400).json({
      success: false,
      error: "Invalid URL format. Expected /api/events/[dateKey]/[eventId]"
    })
  }

  const [dateKey, eventId] = slug

  try {
    switch (req.method) {
      case "PUT":
        // PUT /api/events/[dateKey]/[eventId] - Update an event
        const updatedEventData = req.body

        const updatedEvent = await EventsService.updateEvent(
          dateKey,
          eventId,
          updatedEventData
        )

        if (!updatedEvent) {
          return res
            .status(404)
            .json({ success: false, error: "Event not found" })
        }

        return res.json({ success: true, data: updatedEvent })

      case "DELETE":
        // DELETE /api/events/[dateKey]/[eventId] - Delete an event
        const deleted = await EventsService.deleteEvent(dateKey, eventId)

        if (!deleted) {
          return res
            .status(404)
            .json({ success: false, error: "Event not found" })
        }

        return res.json({ success: true })

      default:
        res.setHeader("Allow", ["PUT", "DELETE", "OPTIONS"])
        return res
          .status(405)
          .json({ success: false, error: `Method ${req.method} Not Allowed` })
    }
  } catch (error) {
    console.error("API Error:", error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    })
  }
}
