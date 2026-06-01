import { dueBucket, formatDue, PRIORITIES } from '../lib/format'

const GROUPS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No date' },
]

// Lightweight scheduler: tasks grouped by due date.
export default function CalendarView({ tasks, columns, onCardClick }) {
  const colMap = Object.fromEntries(columns.map((c) => [c.id, c]))

  const buckets = {}
  for (const g of GROUPS) buckets[g.key] = []
  for (const t of tasks) buckets[dueBucket(t.due_date)].push(t)

  // Sort dated buckets by date ascending.
  for (const key of ['overdue', 'week', 'later']) {
    buckets[key].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
  }

  const hasAny = tasks.length > 0

  if (!hasAny) {
    return (
      <div className="center-state">
        <div className="big">Nothing scheduled</div>
        <div>Add tasks on the board and give them due dates.</div>
      </div>
    )
  }

  return (
    <div className="schedule">
      {GROUPS.map((g) => {
        const items = buckets[g.key]
        if (items.length === 0) return null
        return (
          <div className="sched-group" key={g.key}>
            <h3>
              {g.label}
              <span className="n">{items.length}</span>
            </h3>
            {items.map((t) => {
              const col = colMap[t.column_id]
              const due = formatDue(t.due_date)
              const tag = PRIORITIES[t.priority] || PRIORITIES.med
              return (
                <div className="sched-item" key={t.id} onClick={() => onCardClick(t)}>
                  <span
                    className="col-dot"
                    style={{ background: col?.color || '#8d8597' }}
                  />
                  <div className="body">
                    <h4>{t.title}</h4>
                    <div className="sub">
                      {col?.title || 'List'}
                      {due ? ` · ${due}` : ''} · {tag.label}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
