import { useEffect, useMemo, useRef, useState } from 'react'
import { PRIORITIES, formatDue, formatCompleted } from '../lib/format'

// ---- helpers ----
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
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const PRI_RANK = { high: 0, med: 1, low: 2 }
const PRI_TAG = { high: 'P1', med: 'P2', low: 'P3' }

function greeting(h) {
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
function deriveName(email) {
  const local = (email || '').split('@')[0].replace(/[._-].*$/, '').replace(/[^a-zA-Z]/g, '')
  if (!local) return 'there'
  return local.charAt(0).toUpperCase() + local.slice(1)
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Calendar block type from the event title (Hyoshi palette colours).
function classifyBlock(title = '') {
  const t = title.toLowerCase()
  if (/family|mom|dad|kid|dinner|lunch|partner|home/.test(t)) return { type: 'family', color: '#ff7e3d' }
  if (/deep|focus|build|write|code|design|draft|work block/.test(t)) return { type: 'deep', color: '#2a4cf4' }
  if (/call|meeting|sync|1:1|standup|interview|review/.test(t)) return { type: 'call', color: '#7c6cff' }
  return { type: 'fixed', color: '#0d9488' }
}

export default function BriefingView({ tasks, columns, boards, completeTask, reopenTask, email }) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const dayKey = ymd(today)

  // ---- calendar (reuses the existing /api/calendar endpoint) ----
  const [events, setEvents] = useState([])
  const [calError, setCalError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    let alive = true
    const start = today
    const end = addDays(today, 1)
    fetch(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return
        if (ok) {
          setEvents(j.events || [])
          setUpdatedAt(j.fetchedAt || new Date().toISOString())
        } else {
          setCalError(j.error || 'Calendar unavailable')
        }
      })
      .catch(() => alive && setCalError('Calendar service unavailable on this build.'))
    return () => {
      alive = false
    }
  }, [today])

  // ---- bucket tasks (live, from Supabase via props) ----
  const colMap = useMemo(() => Object.fromEntries(columns.map((c) => [c.id, c])), [columns])
  const boardMap = useMemo(() => Object.fromEntries(boards.map((b) => [b.id, b])), [boards])

  const isCompletedToday = (t) => t.completed_at && startOfDay(new Date(t.completed_at)).getTime() === today.getTime()

  function bucketOf(t) {
    const due = t.due_date ? startOfDay(new Date(t.due_date + 'T00:00:00')) : null
    if (due && due.getTime() < today.getTime()) return 'rolled'
    if (due && due.getTime() > today.getTime()) return 'deep'
    return t.priority === 'low' ? 'quick' : 'hot'
  }

  const buckets = useMemo(() => {
    const out = { hot: [], quick: [], rolled: [], deep: [] }
    for (const t of tasks) {
      const completedToday = isCompletedToday(t)
      if (t.completed_at && !completedToday) continue // completed on a prior day → drop
      const key = bucketOf(t)
      out[key].push({ ...t, _done: completedToday })
    }
    // open first, completed-today last; within each by priority then title
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => {
        if (a._done !== b._done) return a._done ? 1 : -1
        const pr = (PRI_RANK[a.priority] ?? 1) - (PRI_RANK[b.priority] ?? 1)
        return pr !== 0 ? pr : (a.title || '').localeCompare(b.title || '')
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, today])

  // progress ring: done = completed-today in scope, total = everything in scope
  const inScope = [...buckets.hot, ...buckets.quick, ...buckets.rolled, ...buckets.deep]
  const total = inScope.length
  const done = inScope.filter((t) => t._done).length

  // ---- collapsible sections ----
  const [collapsed, setCollapsed] = useState({})
  const toggle = (k) => setCollapsed((p) => ({ ...p, [k]: !p[k] }))

  // ---- section refs for stat-tile jump + flash ----
  const sectionRefs = { schedule: useRef(null), hot: useRef(null), quick: useRef(null) }
  const [flash, setFlash] = useState(null)
  function jumpTo(key) {
    const el = sectionRefs[key]?.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFlash(key)
    setTimeout(() => setFlash((f) => (f === key ? null : f)), 1100)
  }

  // ---- five-priorities ritual (persisted per day) ----
  const storeKey = `hyoshi.priorities.${dayKey}`
  const [priorities, setPriorities] = useState(['', '', '', '', ''])
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        setPriorities(parsed.values || ['', '', '', '', ''])
        setLocked(!!parsed.locked)
      } else {
        setPriorities(['', '', '', '', ''])
        setLocked(false)
      }
    } catch {
      /* ignore */
    }
  }, [storeKey])
  function savePriorities(values, lock) {
    setPriorities(values)
    if (lock !== undefined) setLocked(lock)
    localStorage.setItem(storeKey, JSON.stringify({ values, locked: lock ?? locked }))
  }

  // ---- hand-off ----
  const [handoffLabel, setHandoffLabel] = useState('Have Hyoshi run today’s tasks')
  function handoff() {
    const lines = [
      `Here is my day (${today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}).`,
      `Priorities (${total - done} open, ${done} done):`,
      ...buckets.hot.filter((t) => !t._done).slice(0, 8).map((t) => `- [${PRI_TAG[t.priority]}] ${t.title}`),
      buckets.rolled.length ? `Rolled over: ${buckets.rolled.filter((t) => !t._done).map((t) => t.title).join('; ')}` : '',
      `Please help me plan and run these today.`,
    ].filter(Boolean)
    const text = lines.join('\n')
    if (typeof window !== 'undefined' && typeof window.sendPrompt === 'function') {
      window.sendPrompt(text)
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setHandoffLabel('Copied today’s plan ✓')
        setTimeout(() => setHandoffLabel('Have Hyoshi run today’s tasks'), 1800)
      })
    } else {
      setHandoffLabel('Assistant not available here')
      setTimeout(() => setHandoffLabel('Have Hyoshi run today’s tasks'), 1800)
    }
  }

  // ---- timeline blocks (timed events, height ∝ duration) ----
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const s = new Date(e.start)
      const en = new Date(e.end)
      const mins = Math.max(15, Math.round((en - s) / 60000))
      return { ...e, _start: s, _mins: mins, ...classifyBlock(e.title) }
    })
    .sort((a, b) => a._start - b._start)
  const allDay = events.filter((e) => e.allDay)
  const [openBlock, setOpenBlock] = useState(null)
  const hotCandidates = buckets.hot.filter((t) => !t._done).slice(0, 3)

  // "shape of the day"
  const busyMins = timed.reduce((n, b) => n + b._mins, 0)
  const anchor = timed.slice().sort((a, b) => b._mins - a._mins)[0]
  const shape = timed.length === 0
    ? 'Wide open · no fixed blocks today'
    : `${busyMins >= 360 ? 'Fully blocked' : busyMins >= 180 ? 'Busy' : 'Some open time'} · ${anchor.title} ${fmtTime(anchor.start)} is your main fixed block`

  const now = new Date()
  const userName = deriveName(email)
  const fullDate = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  // progress ring geometry
  const R = 26
  const C = 2 * Math.PI * R
  const pct = total > 0 ? done / total : 0

  const Tag = ({ children, kind }) => <span className={`bf-tag ${kind || ''}`}>{children}</span>

  // task row
  const [openRow, setOpenRow] = useState(null)
  function TaskRow({ t }) {
    const col = colMap[t.column_id]
    const board = col ? boardMap[col.board_id] : null
    const tag = PRIORITIES[t.priority] || PRIORITIES.med
    const category = t._done ? t.completed_from : col?.title
    const overdue = !t._done && t.due_date && new Date(t.due_date + 'T00:00:00') < today
    const open = openRow === t.id
    return (
      <div className={`bf-row ${t._done ? 'done' : ''}`}>
        <div className="bf-row-main">
          <button
            className={`bf-check ${t._done ? 'checked' : ''}`}
            onClick={() => (t._done ? reopenTask(t.id) : completeTask(t.id))}
            aria-label={t._done ? 'Reopen' : 'Complete'}
          >
            {t._done ? '✓' : ''}
          </button>
          <button className="bf-row-text" onClick={() => setOpenRow(open ? null : t.id)}>
            <span className="bf-row-title">{t.title}</span>
            <span className="bf-tags">
              <Tag kind={t.priority === 'high' ? 'p1' : t.priority === 'med' ? 'p2' : 'p3'}>
                {PRI_TAG[t.priority]}
              </Tag>
              {board && <Tag kind="proj">#{board.title}</Tag>}
              {category && <Tag>{category}</Tag>}
              {overdue && <Tag kind="overdue">overdue</Tag>}
              {t._done && <Tag kind="doneflag">✓ {formatCompleted(t.completed_at)}</Tag>}
            </span>
          </button>
        </div>
        {open && (
          <div className="bf-row-detail">
            {t.due_date && <div className="bf-detail-line">Due {formatDue(t.due_date)}</div>}
            {t.notes ? <div className="bf-detail-note">{t.notes}</div> : <div className="bf-detail-line dim">No notes.</div>}
          </div>
        )}
      </div>
    )
  }

  function Section({ id, title, items, sectionRef, accent }) {
    if (!items || items.length === 0) return null
    const isCol = collapsed[id]
    return (
      <div
        className={`bf-section ${flash === id ? 'flash' : ''}`}
        ref={sectionRef}
        style={accent ? { '--accent': accent } : undefined}
      >
        <button className="bf-section-head" onClick={() => toggle(id)}>
          <span className="bf-dot" style={{ background: accent || 'var(--lime)' }} />
          <h3>{title}</h3>
          <span className="bf-count">{items.length}</span>
          <span className={`chev ${isCol ? '' : 'open'}`}>▾</span>
        </button>
        {!isCol && (
          <div className="bf-section-body">
            {items.map((t) => (
              <TaskRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="briefing-scroll">
      <div className="briefing">
        {/* topbar */}
        <div className="bf-topbar">
          <span className="bf-word">Hyoshi</span>
          <span className="bf-updated">
            <span className="bf-live" /> Updated {updatedAt ? fmtTime(updatedAt) : fmtTime(now.toISOString())}
          </span>
        </div>

        {/* hero */}
        <div className="bf-hero bf-rise" style={{ animationDelay: '0ms' }}>
          <div className="bf-hero-left">
            <div className="bf-greeting">
              {greeting(now.getHours())}, {userName}
            </div>
            <div className="bf-date">{fullDate}</div>
            <div className="bf-shape">{shape}</div>
          </div>
          <div className="bf-ring">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
              <circle
                cx="36"
                cy="36"
                r={R}
                fill="none"
                stroke="var(--lime)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="bf-ring-label">
              <strong>{done}</strong>/{total}
              <span>cleared</span>
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="bf-stats bf-rise" style={{ animationDelay: '60ms' }}>
          <button className="bf-stat" onClick={() => jumpTo('schedule')}>
            <strong>{timed.length}</strong>
            <span>Blocks</span>
          </button>
          <button className="bf-stat" onClick={() => jumpTo('hot')}>
            <strong>{buckets.hot.length}</strong>
            <span>Priorities</span>
          </button>
          <button className="bf-stat" onClick={() => jumpTo('quick')}>
            <strong>{buckets.quick.length}</strong>
            <span>Quick Wins</span>
          </button>
        </div>

        {/* hand-off */}
        <button className="bf-handoff bf-rise" style={{ animationDelay: '120ms' }} onClick={handoff}>
          {handoffLabel}
        </button>

        {/* schedule timeline */}
        <div className="bf-section bf-rise" style={{ animationDelay: '180ms' }} ref={sectionRefs.schedule}>
          <button className="bf-section-head" onClick={() => toggle('schedule')}>
            <span className="bf-dot" style={{ background: '#2a4cf4' }} />
            <h3>Today’s Schedule</h3>
            <span className="bf-count">{timed.length}</span>
            <span className={`chev ${collapsed.schedule ? '' : 'open'}`}>▾</span>
          </button>
          {!collapsed.schedule && (
            <div className={`bf-section-body ${flash === 'schedule' ? 'flash' : ''}`}>
              {allDay.length > 0 && (
                <div className="bf-allday">
                  {allDay.map((e, i) => (
                    <span key={i} className="bf-allday-pill">
                      {e.title}
                    </span>
                  ))}
                </div>
              )}
              {calError ? (
                <div className="bf-empty">{calError}</div>
              ) : timed.length === 0 ? (
                <div className="bf-empty">No calendar blocks today.</div>
              ) : (
                <div className="bf-timeline">
                  {timed.map((b, i) => (
                    <div
                      key={i}
                      className="bf-block"
                      style={{ minHeight: Math.min(180, 30 + b._mins * 0.7), borderColor: b.color }}
                      onClick={() => b.type === 'deep' && setOpenBlock(openBlock === i ? null : i)}
                    >
                      <span className="bf-block-bar" style={{ background: b.color }} />
                      <div className="bf-block-body">
                        <div className="bf-block-time">{fmtTime(b.start)}</div>
                        <div className="bf-block-title">{b.title}</div>
                        <span className="bf-tag" style={{ color: b.color, borderColor: b.color }}>
                          {b.type}
                        </span>
                        {b.type === 'deep' && (
                          <span className="bf-block-hint">{openBlock === i ? '▲ candidates' : '▾ fill this block'}</span>
                        )}
                        {b.type === 'deep' && openBlock === i && (
                          <div className="bf-block-candidates">
                            {hotCandidates.length === 0 ? (
                              <div className="bf-detail-line dim">No candidate tasks.</div>
                            ) : (
                              hotCandidates.map((t) => (
                                <div key={t.id} className="bf-candidate">
                                  • {t.title}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* task sections */}
        <div className="bf-rise" style={{ animationDelay: '240ms' }}>
          <Section id="hot" title="Hot" items={buckets.hot} sectionRef={sectionRefs.hot} accent="#fb2c36" />
        </div>
        <div className="bf-rise" style={{ animationDelay: '300ms' }}>
          <Section id="quick" title="Quick Wins" items={buckets.quick} sectionRef={sectionRefs.quick} accent="#c8f531" />
        </div>
        <div className="bf-rise" style={{ animationDelay: '360ms' }}>
          <Section id="rolled" title="Rolled Over" items={buckets.rolled} accent="#ff7e3d" />
        </div>
        <div className="bf-rise" style={{ animationDelay: '420ms' }}>
          <Section id="deep" title="Deep / Setup" items={buckets.deep} accent="#7c6cff" />
        </div>

        {/* priorities ritual */}
        <div className="bf-section bf-ink bf-rise" style={{ animationDelay: '480ms' }}>
          <div className="bf-section-head static">
            <span className="bf-dot" style={{ background: 'var(--lime)' }} />
            <h3>Your five priorities today</h3>
          </div>
          <div className="bf-section-body">
            {priorities.map((v, i) => (
              <div className="bf-pri-row" key={i}>
                <span className="bf-pri-num">{i + 1}</span>
                <input
                  className="bf-pri-input"
                  value={v}
                  readOnly={locked}
                  placeholder={`Priority ${i + 1}`}
                  onChange={(e) => {
                    const next = priorities.slice()
                    next[i] = e.target.value
                    savePriorities(next)
                  }}
                />
              </div>
            ))}
            <button
              className={`bf-lock ${locked ? 'locked' : ''}`}
              onClick={() => savePriorities(priorities, !locked)}
            >
              {locked ? '🔒 Locked in for today — tap to edit' : 'Lock in the day'}
            </button>
          </div>
        </div>

        <div className="bf-footer">Generated from your Calendar + tasks · Hyoshi</div>
      </div>
    </div>
  )
}
