// Priority tag styling, matching the prototype's palette.
export const PRIORITIES = {
  low: { label: 'Low', bg: 'rgba(90,209,205,0.18)', fg: '#7fe6e2' },
  med: { label: 'Medium', bg: 'rgba(124,108,255,0.20)', fg: '#b3a8ff' },
  high: { label: 'High', bg: 'rgba(255,126,182,0.20)', fg: '#ffa8cd' },
}

// Default colours offered when creating / editing a column.
export const COLUMN_COLORS = ['#7c6cff', '#ff7eb6', '#5ad1cd', '#f7b955', '#9d8cff', '#8d8597']

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Parse a 'YYYY-MM-DD' date string as a *local* date (avoids timezone drift).
export function parseDue(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// Friendly label for a due date: Today, Tomorrow, Yesterday, weekday, or "Jun 3".
export function formatDue(dateStr) {
  const date = parseDue(dateStr)
  if (!date) return null
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((target - today) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' })
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function isOverdue(dateStr) {
  const date = parseDue(dateStr)
  if (!date) return false
  return startOfDay(date) < startOfDay(new Date())
}

// Bucket a due date for the schedule view.
export function dueBucket(dateStr) {
  const date = parseDue(dateStr)
  if (!date) return 'none'
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((target - today) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 7) return 'week'
  return 'later'
}
