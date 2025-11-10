// Firebase configuration - you'll need to replace this with your actual config
const firebaseConfig = {
  apiKey: "AIzaSyDAaZo9T9CVa2yTC-t6_WL4Ljy-Uce_IeE",
  authDomain: "meridien-cal.firebaseapp.com",
  databaseURL:
    "https://meridien-cal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "meridien-cal",
  storageBucket: "meridien-cal.firebasestorage.app",
  messagingSenderId: "872918390831",
  appId: "1:872918390831:web:f262c134a3f14ee50d0eda",
  measurementId: "G-TQ3SDN7CF6"
}

// Clear any existing service workers to prevent caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister()
    }
  })
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig)
const auth = firebase.auth()

// Helper function to set secure cookie
function setAuthCookie(token) {
  document.cookie = `firebaseToken=${encodeURIComponent(
    token
  )}; path=/; max-age=3600; samesite=strict`
  localStorage.setItem("firebaseToken", token)
}

// Helper function to clear auth data
function clearAuthData() {
  document.cookie =
    "firebaseToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;"
  localStorage.removeItem("firebaseToken")
}

// Check authentication state and refresh token
let authCheckComplete = false
auth.onAuthStateChanged(async (user) => {
  // Prevent rapid redirects
  if (authCheckComplete) return

  if (user) {
    try {
      // Get fresh token and store it
      const token = await user.getIdToken(true)
      setAuthCookie(token)
      authCheckComplete = true
      console.log("User authenticated successfully")
    } catch (error) {
      console.error("Error refreshing token:", error)
      clearAuthData()
      authCheckComplete = true
      setTimeout(() => {
        window.location.href = "/login"
      }, 500)
    }
  } else {
    // User is not authenticated
    console.log("User not authenticated, redirecting to login")
    clearAuthData()
    authCheckComplete = true
    setTimeout(() => {
      window.location.href = "/login"
    }, 500)
  }
})

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

// Meal definitions - now as arrays
const mealItems = {
  "chicken-qorma": [
    "Chicken Qorma",
    "Vegetable pulao", 
    "One type of sweet",
    "1 type of salad",
    "Variety of Naan",
    "Riata"
  ],
  "mutton-qorma": [
    "Mutton Qorma",
    "Vegetable pulao",
    "One type of sweet", 
    "1 type of salad",
    "Variety of Naan",
    "Riata"
  ]
}

// API helpers
async function apiCall(url, options = {}) {
  try {
    // Get Firebase token from localStorage
    const token = localStorage.getItem("firebaseToken")

    const headers = {
      "Content-Type": "application/json",
      ...options.headers
    }

    // Add Authorization header if token exists
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(url, {
      headers,
      ...options
    })
    // Check if response is unauthorized
    if (response.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem("firebaseToken")
      window.location.href = "/login"
      return
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "API call failed")
    }

    return data
  } catch (error) {
    console.error("API Error:", error)

    // Handle network errors that might indicate auth issues
    if (
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      localStorage.removeItem("firebaseToken")
      window.location.href = "/login"
      return
    }

    throw error
  }
}

// Load all events from server
async function loadEvents(isInitialLoad = false, showLoader = true) {
  try {
    if (!isInitialLoad && showLoader) {
      els.pageLoader.classList.remove("hide")
    }
    const response = await apiCall("/api/events")
    events = response.data || {}
    render()
  } catch (error) {
    console.error("Failed to load events:", error)
    // No local fallback; API is the source of truth
    events = {}
    render()
  } finally {
    if (isInitialLoad) {
      // Show app and hide loader on initial load
      els.app.classList.add("loaded")
      els.pageLoader.classList.add("hide")
    } else if (showLoader) {
      els.pageLoader.classList.add("hide")
    }
  }
}

// Create new event
async function createEvent(dateKey, eventData) {
  try {
    // Optimistic update: add to local state immediately
    if (!events[dateKey]) {
      events[dateKey] = []
    }

    // Create a temporary ID for optimistic update
    const tempId = "temp_" + Date.now()
    const optimisticEvent = { ...eventData, id: tempId }
    events[dateKey].push(optimisticEvent)
    render()

    const response = await apiCall("/api/events", {
      method: "POST",
      body: JSON.stringify({ dateKey, event: eventData })
    })

    // Update with real ID from server
    const realEvent = response.data
    const tempIndex = events[dateKey].findIndex((e) => e.id === tempId)
    if (tempIndex !== -1) {
      events[dateKey][tempIndex] = realEvent
      render()
    }

    return response.data
  } catch (error) {
    console.error("Failed to create event:", error)
    console.error("Create event error details:", error.message)
    // Rollback optimistic update on error (no full page loader)
    await loadEvents(false, false)
    throw error
  }
}

// Update existing event
async function updateEvent(dateKey, eventId, eventData) {
  try {
    // Optimistic update: update local state immediately
    const dateEvents = events[dateKey]
    const eventIndex = dateEvents?.findIndex((e) => e.id === eventId)
    const originalEvent =
      eventIndex !== -1 ? { ...dateEvents[eventIndex] } : null

    if (eventIndex !== -1) {
      events[dateKey][eventIndex] = { ...eventData, id: eventId }
      render()
    }

    const response = await apiCall(`/api/events/${dateKey}/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(eventData)
    })

    // Update with server response
    if (eventIndex !== -1) {
      events[dateKey][eventIndex] = response.data
      render()
    }

    return response.data
  } catch (error) {
    console.error("Failed to update event:", error)
    console.error("Update event error details:", error.message)
    // Rollback optimistic update on error (no full page loader)
    await loadEvents(false, false)
    throw error
  }
}

// Delete event
async function deleteEventAPI(dateKey, eventId) {
  try {
    // Optimistic update: remove from local state immediately
    const dateEvents = events[dateKey]
    const eventIndex = dateEvents?.findIndex((e) => e.id === eventId)
    const deletedEvent =
      eventIndex !== -1 ? { ...dateEvents[eventIndex] } : null

    if (eventIndex !== -1) {
      events[dateKey].splice(eventIndex, 1)
      render()
    }

    await apiCall(`/api/events/${dateKey}/${eventId}`, {
      method: "DELETE"
    })

    return true
  } catch (error) {
    console.error("Failed to delete event:", error)
    // Rollback optimistic update on error - restore deleted event
    if (deletedEvent && eventIndex !== -1) {
      if (!events[dateKey]) events[dateKey] = []
      events[dateKey].splice(eventIndex, 0, deletedEvent)
      render()
    }
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
  app: document.querySelector(".app"),
  calendar: document.querySelector(".calendar"),
  pageLoader: document.getElementById("pageLoader"),
  month: document.getElementById("label-month"),
  year: document.getElementById("label-year"),
  grid: document.getElementById("grid"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  todayBtn: document.getElementById("today"),
  logoutBtn: document.getElementById("logout"),
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
  evMeal: document.getElementById("ev-meal"),
  evMealTitle: document.getElementById("ev-meal-title"),
  evMealItems: document.getElementById("ev-meal-items"),
  mealItemsContainer: document.getElementById("meal-items-container"),
  addMealItemBtn: document.getElementById("add-meal-item"),
  mealFields: document.querySelectorAll(".meal-fields"),
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
    p.addEventListener("click", (event) => {
      event.stopPropagation()
      openSheetForDate(key)
    })
    eventWrap.appendChild(p)
  })
  if ((events[key] || []).length > 3) {
    const more = document.createElement("span")
    more.className = "pill"
    more.textContent = `+${events[key].length - 3} more`
    more.addEventListener("click", (event) => {
      event.stopPropagation()
      openSheetForDate(key)
    })
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
    els.eventForm.classList.remove("show")
  } else {
    els.eventsList.innerHTML =
      '<div style="text-align: center; color: var(--muted); padding: 40px 20px; font-style: italic;">No events found for this month</div>'
    els.eventsList.style.display = "block"
    els.addEventBtn.style.display = "none"
    els.eventForm.classList.remove("show")
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
    { text: "Notes", class: "notes-col" },
    { text: "Meal", class: "meal-col" },
    { text: "Meal Items", class: "meal-items-col" },
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

  // Calculate total pax
  let totalPax = 0
  monthEvents.forEach((event) => {
    const pax = parseInt(event.pax) || 0
    totalPax += pax
  })

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
        dateText = startDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit"
        })
      } else {
        dateText = `${startDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit"
        })} - ${endDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit"
        })}`
      }
    } else {
      const eventDate = new Date(event.start || event.date)
      dateText = eventDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
      })
    }

    dateCell.textContent = dateText
    row.appendChild(dateCell)

    // Type column
    const typeCell = document.createElement("td")
    typeCell.className = "type-col"
    const eventType = event.type || "booking" // Default to booking if type is not present
    if (eventType === "reservation") {
      const reservationBadge = document.createElement("span")
      reservationBadge.className = "reservation-badge"
      reservationBadge.textContent = "RES"
      typeCell.appendChild(reservationBadge)
    } else {
      // Default to booking badge for "booking" or any other/missing type
      const bookingBadge = document.createElement("span")
      bookingBadge.className = "booking-badge"
      bookingBadge.textContent = "BKG"
      typeCell.appendChild(bookingBadge)
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

    // Notes column
    const notesCell = document.createElement("td")
    notesCell.className = "notes-col"
    if (event.notes) {
      notesCell.innerHTML = event.notes.replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;')
    } else {
      notesCell.textContent = "-"
    }
    row.appendChild(notesCell)

    // Meal column
    const mealCell = document.createElement("td")
    mealCell.className = "meal-col"
    if (event.withFood && event.meal) {
      const mealName = event.meal === "chicken-qorma" ? "Chicken Qorma" : 
                      event.meal === "mutton-qorma" ? "Mutton Qorma" : event.meal
      mealCell.textContent = mealName
    } else {
      mealCell.textContent = "-"
    }
    row.appendChild(mealCell)

    // Meal Items column
    const mealItemsCell = document.createElement("td")
    mealItemsCell.className = "meal-items-col"
    if (event.withFood && (event.mealTitle || event.mealItems)) {
      let content = ""
      
      if (event.mealTitle) {
        content += `<div class="meal-title"><strong>${event.mealTitle}</strong></div>`
      }
      
      if (event.mealItems) {
        const itemsList = Array.isArray(event.mealItems) 
          ? event.mealItems.filter(item => item.trim())
          : event.mealItems.split('\n').filter(item => item.trim())
        if (itemsList.length > 0) {
          content += `<div class="meal-items-list">${itemsList.join('<br>')}</div>`
        }
      }
      
      mealItemsCell.innerHTML = content
    } else {
      mealItemsCell.textContent = "-"
    }
    row.appendChild(mealItemsCell)

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

  // Add footer row with total pax
  const footerRow = document.createElement("tr")
  footerRow.className = "footer-row"

  // Empty cells for columns before pax
  for (let i = 0; i < 4; i++) {
    const emptyCell = document.createElement("td")
    emptyCell.innerHTML = i === 3 ? "<strong>Total:</strong>" : ""
    footerRow.appendChild(emptyCell)
  }

  // Total pax cell
  const totalPaxCell = document.createElement("td")
  totalPaxCell.className = "pax-col total-pax"
  totalPaxCell.innerHTML = `<strong>${totalPax}</strong>`
  footerRow.appendChild(totalPaxCell)

  // Empty cells for remaining columns
  for (let i = 0; i < 7; i++) {
    const emptyCell = document.createElement("td")
    footerRow.appendChild(emptyCell)
  }

  tbody.appendChild(footerRow)

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
    els.eventForm.classList.remove("show")
  } else {
    // Show form directly if no events
    els.eventsList.style.display = "none"
    els.addEventBtn.style.display = "none"
    els.eventForm.classList.add("show")
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

    // Add reservation/booking badge to title
    let titleHTML = ""
    const eventType = event.type || "booking" // Default to booking if type is not present
    if (eventType === "reservation") {
      titleHTML += `<span class="reservation-badge">Reservation</span> `
    } else {
      // Default to booking badge for "booking" or any other/missing type
      titleHTML += `<span class="booking-badge">Booking</span> `
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
    const detailEventType = event.type || "booking" // Default to booking if type is not present
    if (detailEventType === "reservation") {
      detailsText += `🔴 Reservation\n`
    } else {
      detailsText += `🟢 Booking\n`
    }
    if (event.venue) detailsText += `📍 ${event.venue}\n`
    if (event.guestName) detailsText += `👤 ${event.guestName}\n`
    if (event.phone) detailsText += `📞 ${event.phone}\n`
    if (event.pax) detailsText += `👥 ${event.pax} guests\n`
    detailsText += `🍽️ ${event.withFood ? "With Food" : "Without Food"}\n`

    // Add meal info if available
    if (event.withFood) {
      if (event.mealTitle) {
        detailsText += `🥘 ${event.mealTitle}\n`
      } else if (event.meal) {
        const mealName = event.meal === "chicken-qorma" ? "Chicken Qorma" : 
                        event.meal === "mutton-qorma" ? "Mutton Qorma" : event.meal
        detailsText += `🥘 ${mealName}\n`
      }
    }

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

    details.innerHTML = detailsText.trim().replace(/\n/g, '<br>') || "No additional details"

    const notes = document.createElement("div")
    notes.className = "notes"
    let notesContent = ""
    
    if (event.notes) {
      notesContent += `"${event.notes.replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;')}"`
    }
    
    // Add meal items if available (with better formatting)
    if (event.withFood && (event.mealTitle || event.mealItems)) {
      if (notesContent) notesContent += "<br><br>"
      
      notesContent += `<div class="meal-items-section">`
      
      if (event.mealTitle) {
        notesContent += `<div class="meal-title"><strong>🍽️ ${event.mealTitle}</strong></div>`
      } else {
        notesContent += `<strong>🍽️ Meal Items:</strong>`
      }
      
      if (event.mealItems) {
        const mealItemsText = Array.isArray(event.mealItems) 
          ? event.mealItems.join('<br>')
          : event.mealItems.replace(/\n/g, '<br>')
        notesContent += `<div class="meal-items-list">${mealItemsText}</div>`
      }
      
      notesContent += `</div>`
    }
    
    if (notesContent) {
      notes.innerHTML = notesContent
    }

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
    if (notesContent) content.appendChild(notes)

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
  
  // Handle meal fields
  els.evMeal.value = event.meal || ""
  
  // Populate meal items - handle both old string format and new array format
  if (event.mealItems) {
    populateMealItems(event.mealItems)
  } else {
    populateMealItems([])
  }
  
  // Show/hide meal fields based on withFood state
  const showMealFields = event.withFood || false
  els.mealFields.forEach(field => {
    field.style.display = showMealFields ? "block" : "none"
  })

  els.eventsList.style.display = "none"
  els.addEventBtn.style.display = "none"
  els.eventForm.classList.add("show")

  // Store the index and ID being edited
  els.eventForm.dataset.editIndex = index
  els.eventForm.dataset.editEventId = event.id
}

async function deleteEvent(index) {
  if (!selectedKey) return

  const list = events[selectedKey] || []
  const event = list[index]

  if (!event.id) {
    // No local delete without ID; refresh from server to reconcile (no full page loader)
    await loadEvents(false, false)
    const refreshed = events[selectedKey] || []
    if (refreshed.length > 0) {
      showEventsList(refreshed)
    } else {
      els.eventsList.style.display = "none"
      els.addEventBtn.style.display = "none"
      els.eventForm.classList.add("show")
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
      els.addEventBtn.style.display = "block"
      els.eventForm.classList.remove("show")
    } else {
      els.eventsList.style.display = "none"
      els.addEventBtn.style.display = "none"
      els.eventForm.classList.add("show")
      clearForm()
      // Prefill start date from selected day
      els.evStartDate.value = selectedKey
      els.evStartTime.value = ""
      els.evEndTime.value = ""
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
  if (els.evTitle) els.evTitle.value = ""
  if (els.evNotes) els.evNotes.value = ""
  if (els.evStartDate) els.evStartDate.value = ""
  if (els.evStartTime) els.evStartTime.value = ""
  if (els.evEndTime) els.evEndTime.value = ""
  if (els.evType) els.evType.value = "booking"
  if (els.evMealType) els.evMealType.value = "lunch"
  if (els.evGuestName) els.evGuestName.value = ""
  if (els.evPhone) els.evPhone.value = ""
  if (els.evPax) els.evPax.value = ""
  if (els.evVenue) els.evVenue.value = "Dar-ul-Khaas"
  if (els.evWithFood) els.evWithFood.checked = false
  if (els.evMeal) els.evMeal.value = ""
  if (els.evMealTitle) els.evMealTitle.value = ""
  if (els.evMealItems) els.evMealItems.value = ""
  if (els.eventForm) {
    delete els.eventForm.dataset.editIndex
    delete els.eventForm.dataset.editEventId
  }

  // Hide meal fields by default
  if (els.mealFields) {
    els.mealFields.forEach(field => {
      field.style.display = "none"
    })
  }

  // Set default times for lunch
  if (els.evStartTime) els.evStartTime.value = "12:00"
  if (els.evEndTime) els.evEndTime.value = "16:00"
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
els.logoutBtn.addEventListener("click", async () => {
  try {
    await auth.signOut()
    clearAuthData()
    window.location.href = "/login"
  } catch (error) {
    console.error("Logout error:", error)
    // Force logout even if there's an error
    clearAuthData()
    window.location.href = "/login"
  }
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

  // Check if required elements exist
  if (!els.evStartDate || !els.evStartTime || !els.evEndTime || !els.evTitle || !els.evPax) {
    alert("Form elements not loaded properly. Please refresh the page.")
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
    notes: els.evNotes ? els.evNotes.value.trim() : "",
    start: startIso,
    end: endIso,
    guestName: els.evGuestName ? els.evGuestName.value.trim() : "",
    phone: els.evPhone ? els.evPhone.value.trim() : "",
    pax: paxVal,
    venue: els.evVenue ? els.evVenue.value : "",
    withFood: els.evWithFood ? els.evWithFood.checked : false,
    mealType: els.evMealType ? els.evMealType.value : "",
    type: els.evType ? els.evType.value : "booking",
    meal: els.evMeal ? els.evMeal.value : "",
    mealItems: getMealItemValues()
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

    // No need to call loadEvents() - optimistic updates handle the UI
    if (selectedKey) {
      const list = events[selectedKey] || []
      showEventsList(list)
      els.addEventBtn.style.display = "block"
      els.eventForm.classList.remove("show")
    }
  } catch (error) {
    console.error("Save event error:", error)
    console.error("Error details:", error.message)
    alert(`Failed to save event: ${error.message || 'Unknown error'}`)
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
      els.eventForm.classList.remove("show")
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
  els.eventForm.classList.add("show")
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

// With Food checkbox handler
els.evWithFood.addEventListener("change", (e) => {
  const showMealFields = e.target.checked
  els.mealFields.forEach(field => {
    field.style.display = showMealFields ? "block" : "none"
  })
  
  // Clear meal selection when hiding fields
  if (!showMealFields) {
    els.evMeal.value = ""
    els.evMealTitle.value = ""
    els.evMealItems.value = ""
  }
})

// Meal management functions
function addMealItem(value = "") {
  const container = els.mealItemsContainer
  const itemDiv = document.createElement("div")
  itemDiv.className = "meal-item-input"
  
  const input = document.createElement("input")
  input.type = "text"
  input.className = "meal-item-input-field"
  input.placeholder = "e.g., Chicken Qorma"
  input.value = value
  
  const removeBtn = document.createElement("button")
  removeBtn.type = "button"
  removeBtn.className = "meal-item-remove"
  removeBtn.textContent = "×"
  removeBtn.addEventListener("click", () => removeMealItem(itemDiv))
  
  itemDiv.appendChild(input)
  itemDiv.appendChild(removeBtn)
  container.appendChild(itemDiv)
  
  // Focus on the new input
  input.focus()
  
  return itemDiv
}

function removeMealItem(itemDiv) {
  itemDiv.remove()
}

function clearMealItems() {
  els.mealItemsContainer.innerHTML = ""
}

function getMealItemValues() {
  if (!els.mealItemsContainer) return []
  const inputs = els.mealItemsContainer.querySelectorAll(".meal-item-input-field")
  return Array.from(inputs)
    .map(input => input.value.trim())
    .filter(value => value.length > 0)
}

function populateMealItems(items = []) {
  clearMealItems()
  if (Array.isArray(items) && items.length > 0) {
    items.forEach(item => addMealItem(item))
  } else if (typeof items === "string" && items.trim()) {
    // Handle backwards compatibility with old string format
    const itemsList = items.split('\n').filter(item => item.trim())
    itemsList.forEach(item => addMealItem(item.trim()))
  }
  
  // Always ensure at least one empty input for new items
  if (els.mealItemsContainer.children.length === 0) {
    addMealItem()
  }
}

// Add meal item button handler
els.addMealItemBtn.addEventListener("click", () => {
  addMealItem()
})

// Meal selection handler
els.evMeal.addEventListener("change", (e) => {
  const selectedMeal = e.target.value
  if (selectedMeal && mealItems[selectedMeal]) {
    // Only populate if container is empty to avoid overwriting
    if (els.mealItemsContainer.children.length === 0) {
      populateMealItems(mealItems[selectedMeal])
    } else {
      // Ask user if they want to replace existing items
      if (confirm("Replace current meal items with the selected menu?")) {
        populateMealItems(mealItems[selectedMeal])
      }
    }
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
loadEvents(true) // Load events from API first
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