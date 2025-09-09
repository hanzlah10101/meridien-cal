import type { VercelRequest, VercelResponse } from "@vercel/node"
import { EventsService } from "../src/api/events-service"

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

  try {
    switch (req.method) {
      case "GET":
        // GET /api/events - Get all events
        const events = await EventsService.readEvents()
        return res.json({ success: true, data: events })

      case "POST":
        // POST /api/events - Create a new event
        const { dateKey, event } = req.body

        if (!dateKey || !event) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields: dateKey and event"
          })
        }

        const newEvent = await EventsService.addEvent(dateKey, event)
        return res.json({ success: true, data: newEvent })

      default:
        res.setHeader("Allow", ["GET", "POST", "OPTIONS"])
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
