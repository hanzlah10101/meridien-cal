import { getFirebaseDb } from "../utils/firebase"

export interface Event {
  // Accept both string and number for backward compatibility
  id: string | number
  title?: string
  description?: string
  notes?: string
  time?: string
  start?: string
  end?: string
  guestName?: string
  phone?: string
  pax?: number
  venue?: string
  withFood?: boolean
  mealType?: string
  type?: string
  meal?: "chicken-qorma" | "mutton-qorma" | "" // Enum for meal types
  mealItems?: string[] // Changed from string to array
}

export type EventsData = Record<string, Event[]>

export class EventsService {
  static async readEvents(): Promise<EventsData> {
    const db = getFirebaseDb()
    const snapshot = await db.ref("events").get()
    const events = snapshot.exists() ? (snapshot.val() as EventsData) : {}
    return events || {}
  }

  static async writeEvents(events: EventsData): Promise<void> {
    const db = getFirebaseDb()
    await db.ref("events").set(events)
  }

  static async addEvent(
    dateKey: string,
    event: Omit<Event, "id">
  ): Promise<Event> {
    const db = getFirebaseDb()
    const dateRef = db.ref(`events/${dateKey}`)
    const snapshot = await dateRef.get()
    const list: Event[] = snapshot.exists() ? (snapshot.val() as Event[]) : []

    // Generate a collision-resistant, URL-safe string id
    const newEvent: Event = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }

    list.push(newEvent)
    await dateRef.set(list)

    return newEvent
  }

  static async updateEvent(
    dateKey: string,
    eventId: string,
    updatedEvent: Omit<Event, "id">
  ): Promise<Event | null> {
    const db = getFirebaseDb()
    const dateRef = db.ref(`events/${dateKey}`)
    const snapshot = await dateRef.get()
    if (!snapshot.exists()) return null

    const list = (snapshot.val() as Event[]) || []
    // Match by string form to support both numeric and string IDs
    const idx = list.findIndex((e) => String(e.id) === String(eventId))
    if (idx === -1) return null

    const event: Event = { ...updatedEvent, id: eventId }
    list[idx] = event
    await dateRef.set(list)
    return event
  }

  static async deleteEvent(dateKey: string, eventId: string): Promise<boolean> {
    const db = getFirebaseDb()
    const dateRef = db.ref(`events/${dateKey}`)
    const snapshot = await dateRef.get()
    if (!snapshot.exists()) return false

    const list = (snapshot.val() as Event[]) || []
    const idx = list.findIndex((e) => String(e.id) === String(eventId))
    if (idx === -1) return false

    list.splice(idx, 1)

    if (list.length === 0) {
      // remove the dateKey node entirely
      await dateRef.remove()
    } else {
      await dateRef.set(list)
    }
    return true
  }
}
