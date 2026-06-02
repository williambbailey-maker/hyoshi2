import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Google Calendar timeline (calendar only — no tasks here).
const START_HOUR = 6
const END_HOUR = 24
const HOUR_PX = 76
const PALETTE = ['#2a4cf4', '#fb2c36', '#ff7e3d', '#7c6cff', '#0d9488', '#d6258f']

const pad = (n) => String(n).padStart(2, '0')
const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const currentMinutes = () => {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function hashColor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}
const colorFor = (ev) => ev.color || hashColor(ev.title || '')

function fmtHour(h) {
  const hr = h % 24
  const ampm = hr < 12 ? 'AM' : 'PM'
  const display = hr % 12 === 0 ? 12 : hr % 12
  return `${display} ${ampm}`
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function fmtClock(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Does an all-day event cover the given 'YYYY-MM-DD'? (end is exclusive)
function coversDay(ev, day) {
  if (ev.end > ev.start) return day >= ev.start && day < ev.end
  return day === ev.start
}

// Lay out a day's timed events into non-overlapping lanes (per overlap cluster).
function layoutDay(events, day) {
  const items = events
    .filter((e) => startOfDay(new Date(e.start)).getTime() === day.getTime())
    .map((e) => {
      const s = new Date(e.start)
      const en = new Date(e.end)
      let startMin = s.getHours() * 60 + s.getMinutes()
      let endMin = en.getHours() * 60 + en.getMinutes()
      // ends next day / invalid -> run to end of grid
      if (en - s >= 86400000 || endMin <= startMin) endMin = END_HOUR * 60
      const cStart = Math.max(startMin, START_HOUR * 60)
      const cEnd = Math.min(endMin, END_HOUR * 60)
      return { ev: e, startMin: cStart, endMin: Math.max(cEnd, cStart + 15) }
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  // cluster -> lanes
  let cluster = []
  let clusterEnd = -Infinity
  const flush = (c) => {
    const lanes = []
    for (const it of c) {
      let placed = false
      for (let i = 0; i < lanes.length; i++) {
        if (it.startMin >= lanes[i]) {
          it.lane = i
          lanes[i] = it.endMin
          placed = true
          break
        }
      }
      if (!placed) {
        it.lane = lanes.length
        lanes.push(it.endMin)
      }
    }
    for (const it of c) it.lanes = lanes.length
  }
  for (const it of items) {
    if (cluster.length && it.startMin < clusterEnd) {
      cluster.push(it)
      clusterEnd = Math.max(clusterEnd, it.endMin)
    } else {
      if (cluster.length) flush(cluster)
      cluster = [it]
      clusterEnd = it.endMin
    }
  }
  if (cluster.length) flush(cluster)

  return items.map((it) => ({
    ev: it.ev,
    lane: it.lane,
    lanes: it.lanes,
    topPx: ((it.startMin - START_HOUR * 60) / 60) * HOUR_PX,
    heightPx: Math.max(((it.endMin - it.startMin) / 60) * HOUR_PX, 24),
  }))
}

export default function ScheduleView() {
  const [mode, setMode] = useState('day') // 'day' | '3day'
  const [data, setData] = useState({ events: [], fetchedAt: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nowMin, setNowMin] = useState(currentMinutes())
  const scrollRef = useRef(null)
  const didScroll = useRef(false)

  const today = useMemo(() => startOfDay(new Date()), [])
  const dayCount = mode === 'day' ? 1 : 3
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(today, i)),
    [today, dayCount],
  )

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const start = days[0]
    const end = addDays(days[0], days.length)
    try {
      const r = await fetch(
        `/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`,
      )
      const json = await r.json()
      if (!r.ok) {
        setError(json.error || 'Could not load your calendar.')
      } else {
        setData(json)
      }
    } catch {
      setError('Could not reach the calendar service (it only runs on the deployed site).')
    }
    setLoading(false)
  }, [days])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // keep the "now" line moving
  useEffect(() => {
    const id = setInterval(() => setNowMin(currentMinutes()), 60000)
    return () => clearInterval(id)
  }, [])

  // scroll to ~1h before now, once
  useEffect(() => {
    if (!loading && !didScroll.current && scrollRef.current) {
      didScroll.current = true
      scrollRef.current.scrollTop = Math.max(0, (nowMin / 60 - START_HOUR - 1) * HOUR_PX)
    }
  }, [loading, nowMin])

  const hours = []
  for (let h = START_HOUR; h < END_HOUR; h++) hours.push(h)

  const allDayByDay = days.map((d) =>
    data.events.filter((e) => e.allDay && coversDay(e, ymd(d))),
  )
  const timedByDay = days.map((d) => layoutDay(data.events.filter((e) => !e.allDay), d))
  const hasAllDay = allDayByDay.some((list) => list.length > 0)

  const nowVisible = nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60
  const nowTop = ((nowMin / 60 - START_HOUR) * HOUR_PX).toFixed(1)

  return (
    <div className="sched-cal">
      <div className="cal-toolbar">
        <div className="segmented">
          <button className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}>
            Day
          </button>
          <button className={mode === '3day' ? 'active' : ''} onClick={() => setMode('3day')}>
            3-Day
          </button>
        </div>
        <button className="cal-refresh" onClick={fetchEvents} disabled={loading} aria-label="Refresh">
          ⟳
        </button>
      </div>

      <div className="cal-head">
        <div className="cal-gutter" />
        {days.map((d, i) => (
          <div className={`day-head ${d.getTime() === today.getTime() ? 'today' : ''}`} key={i}>
            <span className="dow">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <span className="dnum">{d.getDate()}</span>
          </div>
        ))}
      </div>

      {hasAllDay && (
        <div className="cal-allday">
          <div className="cal-gutter all-day-label">all-day</div>
          {allDayByDay.map((list, i) => (
            <div className="allday-cell" key={i}>
              {list.map((e, j) => (
                <span
                  className="allday-pill"
                  key={j}
                  style={{ borderColor: colorFor(e), color: colorFor(e) }}
                >
                  {e.title}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {loading && data.events.length === 0 ? (
        <div className="center-state">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="center-state">
          <div className="big">Calendar unavailable</div>
          <div>{error}</div>
          <button className="btn ghost" style={{ flex: 'none', marginTop: 8 }} onClick={fetchEvents}>
            Try again
          </button>
        </div>
      ) : (
        <div className="cal-scroll" ref={scrollRef}>
          <div className="cal-grid" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
            <div className="cal-times">
              {hours.map((h) => (
                <div className="hour-label" key={h} style={{ height: HOUR_PX }}>
                  {fmtHour(h)}
                </div>
              ))}
            </div>
            {days.map((d, i) => (
              <div className="cal-col" key={i}>
                {hours.map((h) => (
                  <div className="hour-line" key={h} style={{ height: HOUR_PX }} />
                ))}
                {d.getTime() === today.getTime() && nowVisible && (
                  <div className="now-line" style={{ top: `${nowTop}px` }}>
                    <span className="now-dot" />
                  </div>
                )}
                {timedByDay[i].map((it, j) => {
                  const c = colorFor(it.ev)
                  return (
                    <div
                      className="event-block"
                      key={j}
                      style={{
                        top: it.topPx,
                        height: it.heightPx,
                        left: `calc(${(it.lane / it.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / it.lanes}% - 4px)`,
                        borderLeft: `3px solid ${c}`,
                      }}
                    >
                      <div className="ev-time" style={{ color: c }}>
                        {fmtTime(it.ev.start)}
                      </div>
                      <div className="ev-title">{it.ev.title}</div>
                      {it.ev.location && it.heightPx > 46 && (
                        <div className="ev-loc">{it.ev.location}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cal-foot">
        {data.fetchedAt && !error
          ? `Updated ${fmtClock(data.fetchedAt)} · Google’s feed can lag a few hours`
          : ''}
      </div>
    </div>
  )
}
