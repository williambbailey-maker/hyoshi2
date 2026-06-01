import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import Card from './Card'

// A collapsible category: tap the header to drop down its tasks. The whole
// column is a drop target, so cards can be dragged onto it even when collapsed.
export default function Column({
  column,
  taskIds,
  taskMap,
  expanded,
  onToggle,
  onAddTask,
  onCardClick,
  onMenu,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div ref={setNodeRef} className={`column ${isOver ? 'over' : ''}`}>
      <div className="col-head" onClick={() => onToggle(column.id)}>
        <span className="dot" style={{ background: column.color || '#0b0b0f' }} />
        <h2>{column.title}</h2>
        <span className="count">{taskIds.length}</span>
        <button
          className="col-menu"
          onClick={(e) => {
            e.stopPropagation()
            onMenu(column)
          }}
          aria-label="Edit list"
        >
          ⋯
        </button>
        <span className={`chev ${expanded ? 'open' : ''}`}>▾</span>
      </div>

      {expanded && (
        <>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div className={`cards ${isOver ? 'drop-active' : ''}`}>
              {taskIds.map((id) => (
                <Card key={id} task={taskMap[id]} onClick={() => onCardClick(taskMap[id])} />
              ))}
              {taskIds.length === 0 && <div className="cards-empty">No tasks yet</div>}
            </div>
          </SortableContext>
          <button className="add-card" onClick={() => onAddTask(column.id)}>
            + Add task
          </button>
        </>
      )}
    </div>
  )
}
