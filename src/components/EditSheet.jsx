import { useEffect, useState } from 'react'
import Sheet from './Sheet'

// Add / edit a task. `editing` is either:
//   { mode: 'new', columnId }  or  { mode: 'edit', task }
export default function EditSheet({ editing, onClose, onCreate, onUpdate, onDelete }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('med')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const isEdit = editing?.mode === 'edit'

  useEffect(() => {
    if (!editing) return
    if (editing.mode === 'edit') {
      const t = editing.task
      setTitle(t.title || '')
      setPriority(t.priority || 'med')
      setDueDate(t.due_date || '')
      setNotes(t.notes || '')
    } else {
      setTitle('')
      setPriority('med')
      setDueDate('')
      setNotes('')
    }
  }, [editing])

  function save() {
    const trimmed = title.trim()
    if (!trimmed) {
      onClose()
      return
    }
    const fields = {
      title: trimmed,
      priority,
      due_date: dueDate || null,
      notes: notes.trim() || null,
    }
    if (isEdit) {
      onUpdate(editing.task.id, fields)
    } else {
      onCreate(editing.columnId, fields)
    }
    onClose()
  }

  return (
    <Sheet open={!!editing} onClose={onClose}>
      <h2 className="sheet-title">{isEdit ? 'Edit task' : 'New task'}</h2>

      <label>Task</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        autoComplete="off"
      />

      <label>Priority</label>
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="low">Low</option>
        <option value="med">Medium</option>
        <option value="high">High</option>
      </select>

      <label>Due date</label>
      <input type="date" value={dueDate || ''} onChange={(e) => setDueDate(e.target.value)} />

      <label>Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything else…"
      />

      <div className="sheet-actions">
        {isEdit ? (
          <button
            className="btn danger"
            onClick={() => {
              onDelete(editing.task.id)
              onClose()
            }}
          >
            Delete
          </button>
        ) : (
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className="btn primary" onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  )
}
