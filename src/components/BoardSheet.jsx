import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { COLUMN_COLORS } from '../lib/format'

// Add / edit a board. `editing` is either:
//   { mode: 'new' }  or  { mode: 'edit', board, index, total }
export default function BoardSheet({ editing, onClose, onCreate, onUpdate, onDelete, onMove }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(COLUMN_COLORS[0])

  const isEdit = editing?.mode === 'edit'

  useEffect(() => {
    if (!editing) return
    if (editing.mode === 'edit') {
      setTitle(editing.board.title || '')
      setColor(editing.board.color || COLUMN_COLORS[0])
    } else {
      setTitle('')
      setColor(COLUMN_COLORS[0])
    }
  }, [editing])

  function save() {
    const trimmed = title.trim()
    if (!trimmed) {
      onClose()
      return
    }
    if (isEdit) {
      onUpdate(editing.board.id, { title: trimmed, color })
    } else {
      onCreate(trimmed, color)
    }
    onClose()
  }

  return (
    <Sheet open={!!editing} onClose={onClose}>
      <h2 className="sheet-title">{isEdit ? 'Edit board' : 'New board'}</h2>

      <label>Name</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Work, Home, Side project"
        autoComplete="off"
      />

      <label>Colour</label>
      <div className="swatches">
        {COLUMN_COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${c === color ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
          />
        ))}
      </div>

      {isEdit && editing.total > 1 && (
        <div className="col-move-row">
          <button
            className="btn ghost"
            disabled={editing.index === 0}
            onClick={() => onMove(editing.board.id, -1)}
          >
            ← Move left
          </button>
          <button
            className="btn ghost"
            disabled={editing.index === editing.total - 1}
            onClick={() => onMove(editing.board.id, 1)}
          >
            Move right →
          </button>
        </div>
      )}

      <div className="sheet-actions">
        {isEdit && editing.total > 1 ? (
          <button
            className="btn danger"
            onClick={() => {
              if (
                window.confirm(
                  `Delete the board "${editing.board.title}"? All its lists and tasks will be permanently removed.`,
                )
              ) {
                onDelete(editing.board.id)
                onClose()
              }
            }}
          >
            Delete board
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
