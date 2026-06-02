import { useState } from 'react'
import { useNotes } from '../hooks/useNotes'
import NoteSheet from './NoteSheet'

// Curate module: a list of notes; tap one to expand and read it. Notes land
// here in-app or by dropping a raw note and filing it as a "curate".
export default function CurateView({ userId }) {
  const { notes, loading, error, addNote, updateNote, deleteNote } = useNotes(userId)
  const [expanded, setExpanded] = useState(() => new Set())
  const [editing, setEditing] = useState(null)

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <>
      {loading ? (
        <div className="center-state">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="center-state">
          <div className="big">Couldn’t load notes</div>
          <div>{error}</div>
        </div>
      ) : (
        <div className="curate">
          {notes.length === 0 && (
            <div className="center-state" style={{ flex: 'none', padding: '40px 20px' }}>
              <div className="big">No notes yet</div>
              <div>Add one below, or drop a note and file it as a curate.</div>
            </div>
          )}

          {notes.map((note) => {
            const isOpen = expanded.has(note.id)
            return (
              <div className="note" key={note.id}>
                <div className="note-head" onClick={() => toggle(note.id)}>
                  <h3>{note.title}</h3>
                  <button
                    className="note-menu"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing({ mode: 'edit', note })
                    }}
                    aria-label="Edit note"
                  >
                    ⋯
                  </button>
                  <span className={`chev ${isOpen ? 'open' : ''}`}>▾</span>
                </div>
                {isOpen && (
                  <div className="note-body">
                    {note.body ? note.body : <span className="note-empty">No content.</span>}
                  </div>
                )}
              </div>
            )
          })}

          <button className="add-col" onClick={() => setEditing({ mode: 'new' })}>
            + Add note
          </button>
        </div>
      )}

      <NoteSheet
        editing={editing}
        onClose={() => setEditing(null)}
        onCreate={addNote}
        onUpdate={updateNote}
        onDelete={deleteNote}
      />
    </>
  )
}
