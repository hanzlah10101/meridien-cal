// Initialize Day.js plugins
dayjs.extend(dayjs_plugin_relativeTime)
dayjs.extend(dayjs_plugin_localizedFormat)

// --- Utilities ---
const pad = (n) => String(n).padStart(2, "0")
const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseKey = (k) => {
  const [y, m, d] = k.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const today = new Date()

// Helper function to determine meal type from start time
const getMealTypeFromStart = (startDateOrString) => {
  if (!startDateOrString) return undefined

  try {
    const startTime = new Date(startDateOrString)
    if (isNaN(startTime.getTime())) return undefined

    const hour = startTime.getHours()
    if (hour >= 6 && hour < 12) {
      return "breakfast"
    } else if (hour >= 12 && hour < 18) {
      return "lunch"
    } else {
      return "dinner" // 18-23 or 0-5
    }
    return undefined
  } catch (error) {
    return undefined
  }
}

// Date formatting helper
const formatDateTime = (dateString) => {
  if (!dateString) return ""
  return dayjs(dateString).format("MMM DD, YYYY [at] h:mm A")
}

const formatDateOnly = (dateString) => {
  if (!dateString) return ""
  return dayjs(dateString).format("MMM DD, YYYY")
}

// Timezone hint (Asia/Karachi)
try {
  document.title = `Calendar — ${Intl.DateTimeFormat([], {
    timeZone: "Asia/Karachi",
    dateStyle: "long"
  }).format(today)}`
} catch {}

// In-memory cache (always refreshed from API)
let events = {}

// API helpers
async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
    })
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "API call failed")
    }

    return data
  } catch (error) {
    console.error("API Error:", error)
    throw error
  }
}

// Load all events from server
async function loadEvents() {
  try {
    els.calendar.classList.add("loading")
    const response = await apiCall("/api/events")
    events = response.data || {}
    render()
  } catch (error) {
    console.error("Failed to load events:", error)
    // No local fallback; API is the source of truth
    events = {}
    render()
  } finally {
    els.calendar.classList.remove("loading")
  }
}

// Create new event
async function createEvent(dateKey, eventData) {
  try {
    const response = await apiCall("/api/events", {
      method: "POST",
      body: JSON.stringify({ dateKey, event: eventData })
    })

    // Always reload from API to keep in sync
    await loadEvents()

    return response.data
  } catch (error) {
    console.error("Failed to create event:", error)
    throw error
  }
}

// Update existing event
async function updateEvent(dateKey, eventId, eventData) {
  try {
    const response = await apiCall(`/api/events/${dateKey}/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(eventData)
    })

    // Reload from API; avoid mutating possibly stale local array
    await loadEvents()

    return response.data
  } catch (error) {
    console.error("Failed to update event:", error)
    throw error
  }
}

// Delete event
async function deleteEventAPI(dateKey, eventId) {
  try {
    await apiCall(`/api/events/${dateKey}/${eventId}`, {
      method: "DELETE"
    })

    // Reload from API to reflect deletion
    await loadEvents()

    return true
  } catch (error) {
    console.error("Failed to delete event:", error)
    throw error
  }
}

// State
let view = new Date(today.getFullYear(), today.getMonth(), 1)
let selectedKey = null // currently editing date key
let showHijri = false

// Constants
const MAX_YEAR = 2030

const els = {
  calendar: document.querySelector(".calendar"),
  month: document.getElementById("label-month"),
  year: document.getElementById("label-year"),
  grid: document.getElementById("grid"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  todayBtn: document.getElementById("today"),
  addQuick: document.getElementById("addQuick"),
  toggleHijri: document.getElementById("toggle-hijri"),
  sheet: document.getElementById("sheet"),
  sheetTitle: document.getElementById("sheet-title"),
  eventsList: document.getElementById("events-list"),
  addEventBtn: document.getElementById("add-event-btn"),
  eventForm: document.getElementById("event-form"),
  evTitle: document.getElementById("ev-title"),
  evNotes: document.getElementById("ev-notes"),
  evStartDate: document.getElementById("ev-start-date"),
  evStartTime: document.getElementById("ev-start-time"),
  evEndTime: document.getElementById("ev-end-time"),
  evType: document.getElementById("ev-type"),
  evMealType: document.getElementById("ev-meal-type"),
  evGuestName: document.getElementById("ev-guest-name"),
  evPhone: document.getElementById("ev-phone"),
  evPax: document.getElementById("ev-pax"),
  evVenue: document.getElementById("ev-venue"),
  evWithFood: document.getElementById("ev-with-food"),
  save: document.getElementById("save"),
  cancel: document.getElementById("cancel")
}

// Try detect Hijri support
let hijriSupported = false
try {
  const t = new Intl.DateTimeFormat("en-u-ca-islamic", {
    day: "numeric"
  }).format(new Date())
  hijriSupported = !!t
} catch {
  hijriSupported = false
}
els.toggleHijri.disabled = !hijriSupported

// Render calendar grid
function render() {
  els.month.textContent = view.toLocaleString(undefined, {
    month: "long"
  })
  // Update the year selector value to match current view
  if (els.year.value !== view.getFullYear().toString()) {
    els.year.value = view.getFullYear()
  }

  const start = new Date(view.getFullYear(), view.getMonth(), 1)
  const startDay = start.getDay() // 0 Sun ... 6 Sat
  const daysInMonth = new Date(
    view.getFullYear(),
    view.getMonth() + 1,
    0
  ).getDate()

  const prevMonthDays = new Date(
    view.getFullYear(),
    view.getMonth(),
    0
  ).getDate()
  const cells = []

  // leading faded days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(
      view.getFullYear(),
      view.getMonth() - 1,
      prevMonthDays - i
    )
    cells.push(cellTemplate(d, true))
  }
  // days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(view.getFullYear(), view.getMonth(), i)
    cells.push(cellTemplate(d, false))
  }
  // trailing days for full weeks (up to 42 cells, 6 weeks)
  while (cells.length % 7 !== 0) {
    const last = parseKey(cells[cells.length - 1].dataset.key)
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    cells.push(cellTemplate(d, true))
  }

  els.grid.innerHTML = ""
  cells.forEach((c) => els.grid.appendChild(c))
}

function cellTemplate(dateObj, faded) {
  const key = toKey(dateObj)
  const cell = document.createElement("button")
  cell.type = "button"
  cell.className =
    "cell" +
    (faded ? " faded" : "") +
    (sameDate(dateObj, today) ? " today" : "")
  cell.setAttribute("role", "gridcell")
  cell.dataset.key = key

  const head = document.createElement("div")
  head.className = "date"
  head.innerHTML = `<span>${dateObj.getDate()}</span>`

  if (showHijri && hijriSupported) {
    try {
      const hijriDay = new Intl.DateTimeFormat("ar-u-ca-islamic", {
        day: "numeric"
      }).format(dateObj)
      const hijri = document.createElement("span")
      hijri.className = "hijri"
      hijri.textContent = hijriDay
      head.appendChild(hijri)
    } catch {}
  }

  const eventWrap = document.createElement("div")
  eventWrap.className = "events"
  ;(events[key] || []).slice(0, 3).forEach((e) => {
    const p = document.createElement("span")
    p.className = "pill"
    p.textContent = e.title
    eventWrap.appendChild(p)
  })
  if ((events[key] || []).length > 3) {
    const more = document.createElement("span")
    more.className = "pill"
    more.textContent = `+${events[key].length - 3} more`
    eventWrap.appendChild(more)
  }

  cell.appendChild(head)
  cell.appendChild(eventWrap)
  cell.addEventListener("click", () => openSheetForDate(key))
  return cell
}

function sameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function openSheetForMonth() {
  const monthName = view.toLocaleString(undefined, { month: "long" })
  const year = view.getFullYear()

  // Get all events for the current month
  const monthEvents = []
  const startOfMonth = new Date(year, view.getMonth(), 1)
  const endOfMonth = new Date(year, view.getMonth() + 1, 0)

  for (let day = 1; day <= endOfMonth.getDate(); day++) {
    const date = new Date(year, view.getMonth(), day)
    const key = toKey(date)
    const dayEvents = events[key] || []

    dayEvents.forEach((event) => {
      monthEvents.push({
        ...event,
        date: date,
        dateString: date.toLocaleDateString()
      })
    })
  }

  // Sort events by date and time
  monthEvents.sort((a, b) => {
    const dateCompare = a.date.getTime() - b.date.getTime()
    if (dateCompare !== 0) return dateCompare

    // If same date, sort by start time
    if (a.start && b.start) {
      return new Date(a.start).getTime() - new Date(b.start).getTime()
    }
    return 0
  })

  els.sheetTitle.textContent = `${monthName} ${year} - All Events (${monthEvents.length})`

  if (monthEvents.length > 0) {
    showMonthEventsList(monthEvents)
    els.addEventBtn.style.display = "none"
    els.eventForm.style.display = "none"
  } else {
    els.eventsList.innerHTML =
      '<div style="text-align: center; color: var(--muted); padding: 40px 20px; font-style: italic;">No events found for this month</div>'
    els.eventsList.style.display = "block"
    els.addEventBtn.style.display = "none"
    els.eventForm.style.display = "none"
  }

  openDrawer()
}

function showMonthEventsList(monthEvents) {
  els.eventsList.innerHTML = ""
  els.eventsList.style.display = "block"

  // Create table container for horizontal scrolling
  const tableContainer = document.createElement("div")
  tableContainer.className = "table-container"

  // Create table
  const table = document.createElement("table")
  table.className = "events-table"

  // Create header
  const thead = document.createElement("thead")
  const headerRow = document.createElement("tr")

  const headers = [
    { text: "No.", class: "count-col" },
    { text: "Date", class: "date-col" },
    { text: "Type", class: "type-col" },
    { text: "Guest Name", class: "guest-col" },
    { text: "Pax", class: "pax-col" },
    { text: "Venue", class: "venue-col" },
    { text: "W/Food", class: "food-col" },
    { text: "Time", class: "time-col" },
    { text: "Actions", class: "actions-col" }
  ]

  headers.forEach((header) => {
    const th = document.createElement("th")
    th.className = header.class
    th.textContent = header.text
    headerRow.appendChild(th)
  })

  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Create body
  const tbody = document.createElement("tbody")

  monthEvents.forEach((event, index) => {
    const row = document.createElement("tr")

    // Count column (row number)
    const countCell = document.createElement("td")
    countCell.className = "count-col"
    countCell.textContent = index + 1
    row.appendChild(countCell)

    // Date column
    const dateCell = document.createElement("td")
    dateCell.className = "date-col"

    let dateText = ""
    if (event.start && event.end) {
      const startDate = new Date(event.start)
      const endDate = new Date(event.end)

      // Check if start and end dates are the same day
      if (startDate.toDateString() === endDate.toDateString()) {
        dateText = startDate.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "2-digit"
        })
      } else {
        dateText = `${startDate.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "2-digit"
        })} - ${endDate.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "2-digit"
        })}`
      }
    } else {
      const eventDate = new Date(event.start || event.date)
      dateText = eventDate.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit"
      })
    }

    dateCell.textContent = dateText
    row.appendChild(dateCell)

    // Type column
    const typeCell = document.createElement("td")
    typeCell.className = "type-col"
    if (event.type === "reservation") {
      const reservationBadge = document.createElement("span")
      reservationBadge.className = "reservation-badge"
      reservationBadge.textContent = "RES"
      typeCell.appendChild(reservationBadge)
    } else {
      typeCell.textContent = "-"
    }
    row.appendChild(typeCell)

    // Guest Name column
    const guestCell = document.createElement("td")
    guestCell.className = "guest-col"
    guestCell.textContent = event.guestName || "-"
    row.appendChild(guestCell)

    // Pax column
    const paxCell = document.createElement("td")
    paxCell.className = "pax-col"
    paxCell.textContent = event.pax || "-"
    row.appendChild(paxCell)

    // Venue column
    const venueCell = document.createElement("td")
    venueCell.className = "venue-col"
    venueCell.textContent = event.venue || "-"
    row.appendChild(venueCell)

    // With Food column
    const foodCell = document.createElement("td")
    foodCell.className = "food-col"
    const foodBadge = document.createElement("span")
    foodBadge.className = `food-badge ${
      event.withFood ? "with-food" : "without-food"
    }`
    foodBadge.textContent = event.withFood ? "w/Food" : "w/o"
    foodCell.appendChild(foodBadge)
    row.appendChild(foodCell)

    // Time column
    const timeCell = document.createElement("td")
    timeCell.className = "time-col"

    let timeText = ""
    let mealBadge = ""

    if (event.start && event.end) {
      const startTime = new Date(event.start)
      const endTime = new Date(event.end)

      const startTimeStr = startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
      const endTimeStr = endTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })

      // Check if times are the same
      if (startTimeStr === endTimeStr) {
        timeText = startTimeStr
      } else {
        timeText = `${startTimeStr} - ${endTimeStr}`
      }

      // Determine meal type for badge
      let mealType = event.mealType || getMealTypeFromStart(event.start)

      if (mealType) {
        mealBadge = `<span class="meal-badge ${mealType}">${
          mealType.charAt(0).toUpperCase() + mealType.slice(1)
        }</span>`
      }
    } else if (event.start) {
      const startTime = new Date(event.start)
      timeText = startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    } else {
      timeText = "-"
    }

    timeCell.innerHTML = timeText + (mealBadge ? ` ${mealBadge}` : "")
    row.appendChild(timeCell)

    // Actions column
    const actionsCell = document.createElement("td")
    actionsCell.className = "actions-col"

    const actionsDiv = document.createElement("div")
    actionsDiv.className = "table-actions"

    const editBtn = document.createElement("button")
    editBtn.className = "btn secondary"
    editBtn.textContent = "Edit"
    editBtn.addEventListener("click", () => {
      // Find the event in its original date and edit it
      const eventKey = toKey(event.date)
      const dayEvents = events[eventKey] || []
      const eventIndex = dayEvents.findIndex((e) => e.id === event.id)

      if (eventIndex !== -1) {
        selectedKey = eventKey
        editEvent(eventIndex)
      }
    })

    const deleteBtn = document.createElement("button")
    deleteBtn.className = "btn danger"
    deleteBtn.textContent = "Del"
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this event?")) return

      // Find the event in its original date and delete it
      const eventKey = toKey(event.date)

      try {
        deleteBtn.classList.add("loading")
        deleteBtn.disabled = true

        await deleteEventAPI(eventKey, event.id)
        render()

        // Refresh the month view
        openSheetForMonth()
      } catch (error) {
        alert("Failed to delete event. Please try again.")
      } finally {
        deleteBtn.classList.remove("loading")
        deleteBtn.disabled = false
      }
    })

    actionsDiv.appendChild(editBtn)
    actionsDiv.appendChild(deleteBtn)
    actionsCell.appendChild(actionsDiv)
    row.appendChild(actionsCell)

    tbody.appendChild(row)
  })

  table.appendChild(tbody)
  tableContainer.appendChild(table)
  els.eventsList.appendChild(tableContainer)
}

function openSheetForDate(key) {
  selectedKey = key
  const d = parseKey(key)
  const list = events[key] || []

  els.sheetTitle.textContent = `${d.toLocaleString(undefined, {
    weekday: "long"
  })}, ${d.toLocaleDateString()}`

  // Show events list if events exist
  if (list.length > 0) {
    showEventsList(list)
    els.addEventBtn.style.display = "block"
    els.eventForm.style.display = "none"
  } else {
    // Show form directly if no events
    els.eventsList.style.display = "none"
    els.addEventBtn.style.display = "none"
    els.eventForm.style.display = "block"
    clearForm()
    // Prefill start date from selected day; keep times empty
    const dIso = key
    els.evStartDate.value = dIso
    els.evStartTime.value = ""
    els.evEndTime.value = ""
  }

  openDrawer()
}

function closeSheet() {
  closeDrawer()
}

function showEventsList(list) {
  els.eventsList.innerHTML = ""
  els.eventsList.style.display = "block"

  list.forEach((event, index) => {
    const eventItem = document.createElement("div")
    eventItem.className = "event-item"

    const content = document.createElement("div")
    content.className = "content"

    const title = document.createElement("div")
    title.className = "title"

    // Add reservation badge to title if it's a reservation
    let titleHTML = ""
    if (event.type === "reservation") {
      titleHTML += `<span class="reservation-badge">Reservation</span> `
    }
    titleHTML += event.title

    // Add meal type badge to title
    let mealType = event.mealType || getMealTypeFromStart(event.start)

    if (mealType) {
      titleHTML += ` <span class="meal-badge ${mealType}">${
        mealType.charAt(0).toUpperCase() + mealType.slice(1)
      }</span>`
    }

    title.innerHTML = titleHTML

    const details = document.createElement("div")
    details.className = "details"

    let detailsText = ""
    if (event.type === "reservation") detailsText += `🔴 Reservation\n`
    if (event.venue) detailsText += `📍 ${event.venue}\n`
    if (event.guestName) detailsText += `👤 ${event.guestName}\n`
    if (event.phone) detailsText += `📞 ${event.phone}\n`
    if (event.pax) detailsText += `👥 ${event.pax} guests\n`
    detailsText += `🍽️ ${event.withFood ? "With Food" : "Without Food"}\n`

    // Add meal type info
    if (event.mealType) {
      const mealText =
        event.mealType.charAt(0).toUpperCase() + event.mealType.slice(1)
      detailsText += `🍴 ${mealText}\n`
    } else {
      const mealType = getMealTypeFromStart(event.start)
      if (mealType) {
        const mealText = mealType.charAt(0).toUpperCase() + mealType.slice(1)
        detailsText += `🍴 ${mealText}\n`
      }
    }

    if (event.start) {
      detailsText += `🕐 Start: ${formatDateTime(event.start)}\n`
    }
    if (event.end) {
      detailsText += `🕐 End: ${formatDateTime(event.end)}\n`
    }

    details.textContent = detailsText.trim() || "No additional details"

    const notes = document.createElement("div")
    notes.className = "notes"
    notes.textContent = event.notes ? `"${event.notes}"` : ""

    const actions = document.createElement("div")
    actions.className = "actions"

    const editBtn = document.createElement("button")
    editBtn.className = "btn secondary"
    editBtn.textContent = "Edit"
    editBtn.addEventListener("click", () => editEvent(index))

    const deleteBtn = document.createElement("button")
    deleteBtn.className = "btn danger"
    deleteBtn.textContent = "Delete"
    deleteBtn.addEventListener("click", () => deleteEvent(index))

    content.appendChild(title)
    content.appendChild(details)
    if (event.notes) content.appendChild(notes)

    actions.appendChild(editBtn)
    actions.appendChild(deleteBtn)

    eventItem.appendChild(content)
    eventItem.appendChild(actions)
    els.eventsList.appendChild(eventItem)
  })
}
function editEvent(index) {
  const list = events[selectedKey] || []
  const event = list[index]

  els.evTitle.value = event.title || ""
  els.evNotes.value = event.notes || ""
  els.evType.value = event.type || "booking"

  // Set meal type based on existing event or determine from time
  els.evMealType.value =
    event.mealType || getMealTypeFromStart(event.start) || "lunch"

  if (event.start) {
    const s = new Date(event.start)
    els.evStartDate.value = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(
      s.getDate()
    )}`
    els.evStartTime.value = `${pad(s.getHours())}:${pad(s.getMinutes())}`
  } else {
    els.evStartDate.value = selectedKey || ""
    els.evStartTime.value = ""
  }
  if (event.end) {
    const e = new Date(event.end)
    els.evEndTime.value = `${pad(e.getHours())}:${pad(e.getMinutes())}`
  } else {
    els.evEndTime.value = ""
  }

  els.evGuestName.value = event.guestName || ""
  els.evPhone.value = event.phone || ""
  els.evPax.value = event.pax || ""
  els.evVenue.value = event.venue || "Dar-ul-Khaas"
  els.evWithFood.checked = event.withFood || false

  els.eventsList.style.display = "none"
  els.addEventBtn.style.display = "none"
  els.eventForm.style.display = "block"

  // Store the index and ID being edited
  els.eventForm.dataset.editIndex = index
  els.eventForm.dataset.editEventId = event.id
}

async function deleteEvent(index) {
  if (!selectedKey) return

  const list = events[selectedKey] || []
  const event = list[index]

  if (!event.id) {
    // No local delete without ID; refresh from server to reconcile
    await loadEvents()
    const refreshed = events[selectedKey] || []
    if (refreshed.length > 0) {
      showEventsList(refreshed)
    } else {
      els.eventsList.style.display = "none"
      els.addEventBtn.style.display = "none"
      els.eventForm.style.display = "block"
      clearForm()
    }
    return
  }

  try {
    // Show loading state on the delete button
    const deleteButtons = document.querySelectorAll(".event-item .btn.danger")
    if (deleteButtons[index]) {
      deleteButtons[index].classList.add("loading")
      deleteButtons[index].disabled = true
    }

    await deleteEventAPI(selectedKey, event.id)
    render()

    // Refresh the events list
    const updatedList = events[selectedKey] || []
    if (updatedList.length > 0) {
      showEventsList(updatedList)
    } else {
      els.eventsList.style.display = "none"
      els.addEventBtn.style.display = "none"
      els.eventForm.style.display = "block"
      clearForm()
    }
  } catch (error) {
    alert("Failed to delete event. Please try again.")
  } finally {
    // Remove loading state
    const deleteButtons = document.querySelectorAll(".event-item .btn.danger")
    if (deleteButtons[index]) {
      deleteButtons[index].classList.remove("loading")
      deleteButtons[index].disabled = false
    }
  }
}

function clearForm() {
  els.evTitle.value = ""
  els.evNotes.value = ""
  els.evStartDate.value = ""
  els.evStartTime.value = ""
  els.evEndTime.value = ""
  els.evType.value = "booking"
  els.evMealType.value = "lunch"
  els.evGuestName.value = ""
  els.evPhone.value = ""
  els.evPax.value = ""
  els.evVenue.value = "Dar-ul-Khaas"
  els.evWithFood.checked = false
  delete els.eventForm.dataset.editIndex
  delete els.eventForm.dataset.editEventId

  // Set default times for lunch
  els.evStartTime.value = "12:00"
  els.evEndTime.value = "16:00"
}

// Actions
els.month.addEventListener("click", () => {
  openSheetForMonth()
})

els.prev.addEventListener("click", () => {
  view = new Date(view.getFullYear(), view.getMonth() - 1, 1)
  render()
  updateNavigationButtons()
})
els.next.addEventListener("click", () => {
  view = new Date(view.getFullYear(), view.getMonth() + 1, 1)
  render()
  updateNavigationButtons()
})
els.todayBtn.addEventListener("click", () => {
  view = new Date(today.getFullYear(), today.getMonth(), 1)
  render()
  updateNavigationButtons()
})
els.addQuick.addEventListener("click", () => {
  openSheetForDate(toKey(today))
})

// Form submission with validation
els.eventForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  if (!selectedKey) return

  // Native constraint validation first
  if (!els.eventForm.checkValidity()) {
    els.eventForm.reportValidity()
    return
  }

  // Compose ISO datetimes from date+time; times are required by inputs
  const startIso = new Date(
    `${els.evStartDate.value}T${els.evStartTime.value}:00`
  ).toISOString()
  const endIso = new Date(
    `${els.evStartDate.value}T${els.evEndTime.value}:00`
  ).toISOString()

  // Extra validations
  if (new Date(endIso) < new Date(startIso)) {
    alert("End must be after Start.")
    return
  }

  const paxVal = parseInt(els.evPax.value)
  if (Number.isNaN(paxVal) || paxVal < 1) {
    alert("Pax must be a positive number.")
    return
  }

  const entry = {
    title: els.evTitle.value.trim(),
    notes: els.evNotes.value.trim() || "",
    start: startIso,
    end: endIso,
    guestName: els.evGuestName.value.trim(),
    phone: els.evPhone.value.trim(),
    pax: paxVal,
    venue: els.evVenue.value,
    withFood: els.evWithFood.checked,
    mealType: els.evMealType.value,
    type: els.evType.value
  }

  try {
    els.save.classList.add("loading")
    els.save.disabled = true

    const editIndex = els.eventForm.dataset.editIndex
    const editEventId = els.eventForm.dataset.editEventId

    if (editIndex !== undefined && editEventId) {
      await updateEvent(selectedKey, editEventId, entry)
    } else {
      await createEvent(selectedKey, entry)
    }

    await loadEvents()

    if (selectedKey) {
      const list = events[selectedKey] || []
      showEventsList(list)
      els.addEventBtn.style.display = "block"
      els.eventForm.style.display = "none"
    }

    render()
  } catch (error) {
    alert("Failed to save event. Please try again.")
  } finally {
    els.save.classList.remove("loading")
    els.save.disabled = false
  }
})

els.cancel.addEventListener("click", () => {
  // If editing, go back to events list; if adding new, close sheet
  if (els.eventForm.dataset.editIndex !== undefined) {
    const list = events[selectedKey] || []
    if (list.length > 0) {
      showEventsList(list)
      els.addEventBtn.style.display = "block"
      els.eventForm.style.display = "none"
    } else {
      closeSheet()
    }
  } else {
    closeSheet()
  }
})

// Add Event button functionality
els.addEventBtn.addEventListener("click", () => {
  clearForm()
  els.eventsList.style.display = "none"
  els.addEventBtn.style.display = "none"
  els.eventForm.style.display = "block"
  if (selectedKey) {
    els.evStartDate.value = selectedKey
    els.evStartTime.value = ""
    els.evEndTime.value = ""
  }
})

els.toggleHijri.addEventListener("change", (e) => {
  showHijri = e.target.checked
  render()
})

// Meal type change handler
els.evMealType.addEventListener("change", (e) => {
  const mealType = e.target.value
  if (mealType === "lunch") {
    els.evStartTime.value = "12:00"
    els.evEndTime.value = "16:00"
  } else if (mealType === "dinner") {
    els.evStartTime.value = "18:00"
    els.evEndTime.value = "22:00"
  }
})

// Set default times on page load
els.evStartTime.value = "12:00"
els.evEndTime.value = "16:00"

// Header drag and click functionality
const sheet = document.getElementById("sheet")
const sheetHeader = document.getElementById("sheet-header")
const overlay = document.getElementById("overlay")

let isDragging = false
let startY = 0
let currentY = 0
let sheetHeight = 0

// Touch and mouse event handlers
function handleStart(e) {
  isDragging = true
  startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY
  sheetHeight = sheet.offsetHeight
  sheet.style.transition = "none"
  document.body.style.overflow = "hidden"
}

function handleMove(e) {
  if (!isDragging) return

  e.preventDefault()
  currentY =
    (e.type === "touchmove" ? e.touches[0].clientY : e.clientY) - startY

  if (currentY > 0) {
    const newBottom = Math.max(-currentY, -sheetHeight)
    sheet.style.bottom = `${newBottom}px`

    // Update overlay opacity
    const progress = Math.min(currentY / (sheetHeight * 0.4), 1)
    overlay.style.opacity = 1 - progress * 0.7
  }
}

function handleEnd(e) {
  if (!isDragging) return

  isDragging = false
  document.body.style.overflow = ""
  sheet.style.transition = "bottom 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)"

  // If dragged down more than 25% of sheet height, close
  if (currentY > sheetHeight * 0.25) {
    closeDrawer()
  } else {
    // Snap back
    sheet.style.bottom = "0"
    overlay.style.opacity = "1"
  }

  currentY = 0
}

// Add event listeners for touch and mouse
sheetHeader.addEventListener("touchstart", handleStart, {
  passive: false
})
sheetHeader.addEventListener("touchmove", handleMove, { passive: false })
sheetHeader.addEventListener("touchend", handleEnd)

sheetHeader.addEventListener("mousedown", handleStart)
document.addEventListener("mousemove", handleMove)
document.addEventListener("mouseup", handleEnd)

// Click to close (only if not dragged)
sheetHeader.addEventListener("click", (e) => {
  if (Math.abs(currentY) < 5) {
    // Only close if it was a click, not a drag
    closeDrawer()
  }
})

// Overlay click handler
overlay.addEventListener("click", () => {
  closeDrawer()
})

function closeDrawer() {
  sheet.style.bottom = "-100%"
  overlay.style.opacity = "0"

  setTimeout(() => {
    sheet.setAttribute("aria-hidden", "true")
    overlay.classList.remove("active")
    sheet.classList.remove("open")
    sheet.style.bottom = ""
    overlay.style.opacity = ""
  }, 300)
}

function openDrawer() {
  sheet.setAttribute("aria-hidden", "false")
  overlay.classList.add("active")
  sheet.classList.add("open")
}

function updateNavigationButtons() {
  if (view.getFullYear() >= MAX_YEAR) {
    els.next.disabled = true
    els.next.style.opacity = "0.5"
    els.next.style.cursor = "not-allowed"
  } else {
    els.next.disabled = false
    els.next.style.opacity = "1"
    els.next.style.cursor = "pointer"
  }
}

function populateYearSelector() {
  const currentYear = today.getFullYear()

  els.year.innerHTML = ""

  for (let year = currentYear; year <= MAX_YEAR; year++) {
    const option = document.createElement("option")
    option.value = year
    option.textContent = year
    els.year.appendChild(option)
  }

  // Set the selected year after populating
  els.year.value = view.getFullYear()
}

function populateVenueSelector() {
  const venues = ["Dar-ul-Khaas", "Aroos-ul-Bahar", "Grand Marquee"]

  els.evVenue.innerHTML = ""

  venues.forEach((venue) => {
    const option = document.createElement("option")
    option.value = venue
    option.textContent = venue
    els.evVenue.appendChild(option)
  })
}

// Initial render
loadEvents() // Load events from API first
updateNavigationButtons()

// Populate year selector and add change event
populateYearSelector()
populateVenueSelector()
els.year.addEventListener("change", (e) => {
  const selectedYear = parseInt(e.target.value)
  view = new Date(selectedYear, view.getMonth(), 1)
  render()
  updateNavigationButtons()
})
