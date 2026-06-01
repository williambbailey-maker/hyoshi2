import ICAL from 'ical.js'

// Vercel serverless function (Node). Reads the secret iCal URL from the
// CALENDAR_ICAL_URL env var, fetches & parses the feed server-side, expands
// recurring events for the requested [start, end) range, and returns JSON.
//
// The secret URL never reaches the browser: the client only calls /api/calendar.

const MAX_OCCURRENCES = 1500 // safety cap per recurring event

function pad(n) {
  return String(n).padStart(2, '0')
}

// 'YYYY-MM-DD' from an ICAL.Time (all-day events have no meaningful time/zone).
function isoDate(t) {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`
}

function serialize(startTime, endTime, ev, vevent, calColor) {
  const allDay = startTime.isDate === true
  const color = vevent.getFirstPropertyValue('color') || calColor || null
  if (allDay) {
    return {
      title: ev.summary || '(no title)',
      allDay: true,
      start: isoDate(startTime),
      end: endTime ? isoDate(endTime) : isoDate(startTime),
      location: ev.location || null,
      description: ev.description || null,
      color,
    }
  }
  const s = startTime.toJSDate()
  const e = (endTime || startTime).toJSDate()
  return {
    title: ev.summary || '(no title)',
    allDay: false,
    start: s.toISOString(),
    end: e.toISOString(),
    location: ev.location || null,
    description: ev.description || null,
    color,
  }
}

function expand(icsText, rangeStart, rangeEnd) {
  const comp = new ICAL.Component(ICAL.parse(icsText))
  const calColor = comp.getFirstPropertyValue('x-apple-calendar-color') || null
  const vevents = comp.getAllSubcomponents('vevent')

  // Separate recurrence masters from exception overrides, and relate them so
  // ical.js applies overrides + EXDATE correctly.
  const masters = {}
  const exceptions = []
  for (const ve of vevents) {
    const e = new ICAL.Event(ve)
    if (e.isRecurrenceException()) exceptions.push({ e, ve })
    else masters[e.uid] = { e, ve }
  }
  for (const { e } of exceptions) {
    if (masters[e.uid]) masters[e.uid].e.relateException(e)
  }

  const out = []
  const push = (st, en, e, ve) => {
    const ser = serialize(st, en, e, ve, calColor)
    out.push(ser)
  }

  for (const { e, ve } of Object.values(masters)) {
    if (e.isRecurring()) {
      const iter = e.iterator()
      let next
      let count = 0
      while ((next = iter.next()) && count++ < MAX_OCCURRENCES) {
        const startJs = next.toJSDate()
        if (startJs >= rangeEnd) break
        const details = e.getOccurrenceDetails(next)
        const endJs = details.endDate.toJSDate()
        if (endJs <= rangeStart) continue
        push(details.startDate, details.endDate, e, ve)
      }
    } else {
      const startJs = e.startDate.toJSDate()
      const endJs = (e.endDate || e.startDate).toJSDate()
      if (endJs > rangeStart && startJs < rangeEnd) push(e.startDate, e.endDate, e, ve)
    }
  }

  // Exceptions whose master isn't in the feed: include as one-off events.
  for (const { e, ve } of exceptions) {
    if (masters[e.uid]) continue
    const startJs = e.startDate.toJSDate()
    const endJs = (e.endDate || e.startDate).toJSDate()
    if (endJs > rangeStart && startJs < rangeEnd) push(e.startDate, e.endDate, e, ve)
  }

  // Sort: all-day first, then by start time.
  out.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return a.start.localeCompare(b.start)
  })
  return out
}

// Exported for testing.
export { expand }

export default async function handler(req, res) {
  const url = process.env.CALENDAR_ICAL_URL
  if (!url) {
    return res.status(500).json({
      error:
        'CALENDAR_ICAL_URL is not set on the server. Add it in your Vercel project Environment Variables.',
    })
  }

  // Range: default to today if not provided.
  const now = new Date()
  const defStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = req.query.start ? new Date(req.query.start) : defStart
  const end = req.query.end ? new Date(req.query.end) : new Date(defStart.getTime() + 86400000)
  if (isNaN(start) || isNaN(end) || end <= start) {
    return res.status(400).json({ error: 'Invalid start/end range.' })
  }

  let icsText
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Flow-Calendar/1.0' } })
    if (!r.ok) {
      return res.status(502).json({ error: `Calendar feed returned status ${r.status}.` })
    }
    icsText = await r.text()
  } catch {
    return res.status(502).json({ error: 'Could not reach the calendar feed.' })
  }

  let events
  try {
    events = expand(icsText, start, end)
  } catch {
    return res.status(500).json({ error: 'Could not parse the calendar feed.' })
  }

  // Always fresh on request (Google's feed itself can lag a few hours).
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ events, fetchedAt: new Date().toISOString() })
}
