import { FileSystemUtils } from "@/utils/file-system"

export interface Event {
  id: number
  title?: string
  description?: string
  time?: string
}

export type EventsData = Record<string, Event[]>

export class EventsService {
  private static async getEventsFilePath(): Promise<string> {
    return FileSystemUtils.getEventsFilePath()
  }

  static async readEvents(): Promise<EventsData> {
    const filePath = await this.getEventsFilePath()
    const events = await FileSystemUtils.readJsonFile<EventsData>(filePath)
    return events || {}
  }

  static async writeEvents(events: EventsData): Promise<void> {
    const filePath = await this.getEventsFilePath()
    await FileSystemUtils.writeJsonFile(filePath, events)
  }

  static async addEvent(
    dateKey: string,
    event: Omit<Event, "id">
  ): Promise<Event> {
    const events = await this.readEvents()

    if (!events[dateKey]) {
      events[dateKey] = []
    }

    const newEvent: Event = {
      ...event,
      id: Date.now() + Math.random()
    }

    events[dateKey].push(newEvent)
    await this.writeEvents(events)

    return newEvent
  }

  static async updateEvent(
    dateKey: string,
    eventId: number,
    updatedEvent: Omit<Event, "id">
  ): Promise<Event | null> {
    const events = await this.readEvents()

    if (!events[dateKey]) {
      return null
    }

    const eventIndex = events[dateKey].findIndex((e) => e.id == eventId)
    if (eventIndex === -1) {
      return null
    }

    const event: Event = {
      ...updatedEvent,
      id: eventId
    }

    events[dateKey][eventIndex] = event
    await this.writeEvents(events)

    return event
  }

  static async deleteEvent(dateKey: string, eventId: number): Promise<boolean> {
    const events = await this.readEvents()

    if (!events[dateKey]) {
      return false
    }

    const eventIndex = events[dateKey].findIndex((e) => e.id == eventId)
    if (eventIndex === -1) {
      return false
    }

    events[dateKey].splice(eventIndex, 1)

    // Remove date key if no events left
    if (events[dateKey].length === 0) {
      delete events[dateKey]
    }

    await this.writeEvents(events)
    return true
  }
}
