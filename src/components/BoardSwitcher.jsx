// Horizontal strip of board "pills". Tap a board to switch to it; tap the
// already-active board (or its ⋯) to edit it. The dashed + adds a new board.
export default function BoardSwitcher({ boards, selectedId, onSelect, onEdit, onAdd }) {
  const ordered = [...boards].sort((a, b) => a.position - b.position)
  return (
    <div className="board-switcher">
      {ordered.map((b) => {
        const active = b.id === selectedId
        return (
          <button
            key={b.id}
            className={`board-pill ${active ? 'active' : ''}`}
            onClick={() => (active ? onEdit(b) : onSelect(b.id))}
          >
            <span className="bdot" style={{ background: b.color || '#8d8597' }} />
            <span className="btitle">{b.title}</span>
            {active && <span className="bedit">⋯</span>}
          </button>
        )
      })}
      <button className="board-add" onClick={onAdd} aria-label="Add board">
        +
      </button>
    </div>
  )
}
