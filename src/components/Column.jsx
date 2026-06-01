import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import Card from './Card'

// A single Kanban list: header, droppable card area, and an add-task button.
export default function Column({ column, taskIds, taskMap, onAddTask, onCardClick, onMenu }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="column">
      <div className="col-head">
        <span className="dot" style={{ background: column.color || '#8d8597' }} />
        <h2>{column.title}</h2>
        <span className="count">{taskIds.length}</span>
        <button className="col-menu" onClick={() => onMenu(column)} aria-label="Edit list">
          ⋯
        </button>
      </div>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`cards ${isOver ? 'drop-active' : ''}`}>
          {taskIds.map((id) => (
            <Card key={id} task={taskMap[id]} onClick={() => onCardClick(taskMap[id])} />
          ))}
        </div>
      </SortableContext>

      <button className="add-card" onClick={() => onAddTask(column.id)}>
        + Add task
      </button>
    </div>
  )
}
