import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PRIORITIES, formatDue, isOverdue } from '../lib/format'

// Presentational card — also used inside the DragOverlay.
export function CardView({ task, className = '', style, dragRef, listeners, attributes, onClick }) {
  const tag = PRIORITIES[task.priority] || PRIORITIES.med
  const due = formatDue(task.due_date)
  const overdue = isOverdue(task.due_date) && task.due_date
  return (
    <div
      ref={dragRef}
      className={`card ${className}`}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <span className="tag" style={{ background: tag.bg, color: tag.fg }}>
        {tag.label}
      </span>
      <h3>{task.title}</h3>
      {(due || task.notes) && (
        <div className="meta">
          {due && <span className={overdue ? 'overdue' : ''}>◷ {due}</span>}
          {task.notes && <span>✎</span>}
        </div>
      )}
    </div>
  )
}

// Sortable wrapper used inside columns.
export default function Card({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }
  return (
    <CardView
      task={task}
      dragRef={setNodeRef}
      style={style}
      className={isDragging ? 'dragging' : ''}
      listeners={listeners}
      attributes={attributes}
      onClick={onClick}
    />
  )
}
