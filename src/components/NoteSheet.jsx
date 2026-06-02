import { useEffect, useState } from 'react'
import Sheet from './Sheet'

// Add / edit a note. `editing` is { mode: 'new' } or { mode: 'edit', note }.
export default function NoteSheet({ editing, onClose, onCreate, onUpdate, onDelete }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const isEdit = editing?.mode === 'edit'

  useEffect(() => {
    if (!editing) return
    if (editing.mode === 'edit') {
      setTitle(editing.note.title || '')
      setBody(editing.note.body || '')
    } else {
      setTitle('')
      setBody('')
    }
  }, [editing])

  function save() {
    const trimmed = title.trim()
    if (!trimmed) {
      onClose()
      return
    }
    const body2 = body.trim() || null
    if (isEdit) onUpdate(editing.note.id, { title: trimmed, body: body2 })
    else onCreate(trimmed, body2)
    onClose()
  }

  return (
    <Sheet open={!!editing} onClose={onClose}>
      <h2 className="sheet-title">{isEdit ? 'Edit note' : 'New note'}</h2>

      <label>Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        autoComplete="off"
      />

      <label>Note</label>
      <textarea
        className="note-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your note…"
      />

      <div className="sheet-actions">
        {isEdit ? (
          <button
            className="btn danger"
            onClick={() => {
              onDelete(editing.note.id)
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
