import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import Column from './Column'
import { CardView } from './Card'

export default function Board({
  columns,
  tasks,
  onReorder,
  onAddTask,
  onCardClick,
  onColumnMenu,
  onAddColumn,
}) {
  // Local ordering map { columnId: [taskId,...] } for smooth dragging.
  const [items, setItems] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const draggingRef = useRef(false)

  // Rebuild local order from props whenever data changes (but not mid-drag).
  useEffect(() => {
    if (draggingRef.current) return
    const map = {}
    for (const c of columns) map[c.id] = []
    for (const t of tasks) {
      if (map[t.column_id]) map[t.column_id].push(t.id)
    }
    setItems(map)
  }, [columns, tasks])

  // Keep an expanded category in view: drop stale ids, and if nothing is open
  // (e.g. after switching boards) open "Today" if present, else the first list.
  useEffect(() => {
    const ids = columns.map((c) => c.id)
    setExpanded((prev) => {
      const stillOpen = [...prev].filter((id) => ids.includes(id))
      if (stillOpen.length === 0 && ids.length) {
        const ordered = [...columns].sort((a, b) => a.position - b.position)
        const today = ordered.find((c) => /today/i.test(c.title))
        return new Set([(today || ordered[0]).id])
      }
      return new Set(stillOpen)
    })
  }, [columns])

  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]))

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Long-press to drag on touch (so the page still scrolls); small move on mouse.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const findContainer = (id) => {
    if (id in items) return id
    return Object.keys(items).find((key) => items[key].includes(id))
  }

  function handleDragStart(event) {
    draggingRef.current = true
    setActiveId(event.active.id)
  }

  function handleDragOver(event) {
    const { active, over } = event
    if (!over) return
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setItems((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]

      let newIndex
      if (over.id in prev) {
        newIndex = overItems.length
      } else {
        const overIndex = overItems.indexOf(over.id)
        newIndex = overIndex >= 0 ? overIndex : overItems.length
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          active.id,
          ...overItems.slice(newIndex),
        ],
      }
    })
  }

  function handleDragEnd(event) {
    const { active, over } = event
    let finalItems = items

    if (over) {
      const activeContainer = findContainer(active.id)
      const overContainer = findContainer(over.id)
      if (activeContainer && overContainer && activeContainer === overContainer) {
        const list = items[activeContainer]
        const oldIndex = list.indexOf(active.id)
        const newIndex = over.id in items ? list.length - 1 : list.indexOf(over.id)
        if (oldIndex !== newIndex && newIndex >= 0) {
          finalItems = { ...items, [activeContainer]: arrayMove(list, oldIndex, newIndex) }
          setItems(finalItems)
        }
      }
    }

    draggingRef.current = false
    setActiveId(null)
    onReorder(finalItems)
  }

  function handleDragCancel() {
    draggingRef.current = false
    setActiveId(null)
  }

  const orderedColumns = [...columns].sort((a, b) => a.position - b.position)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board">
        {orderedColumns.map((col) => (
          <Column
            key={col.id}
            column={col}
            taskIds={items[col.id] || []}
            taskMap={taskMap}
            expanded={expanded.has(col.id)}
            onToggle={toggle}
            onAddTask={onAddTask}
            onCardClick={onCardClick}
            onMenu={onColumnMenu}
          />
        ))}
        <button className="add-col" onClick={onAddColumn}>
          + Add list
        </button>
      </div>

      <DragOverlay>
        {activeId && taskMap[activeId] ? (
          <CardView task={taskMap[activeId]} className="overlay" />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
