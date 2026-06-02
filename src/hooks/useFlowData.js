import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const STARTER_COLUMNS = [
  { title: 'Today', color: '#c8f531', position: 0 },
  { title: 'To Do', color: '#2a4cf4', position: 1 },
  { title: 'In Progress', color: '#ff7e3d', position: 2 },
  { title: 'Complete', color: '#0d9488', position: 3 },
]

const isCompleteCol = (title) => /^\s*complete\s*$/i.test(title || '')

// Module-level lock: if two loads race on a brand-new account, they share the
// same seeding promise instead of both creating a default board/columns.
let seedLock = null

// Central data layer: loads boards + columns + tasks, keeps them synced across
// devices via realtime, tracks the selected board, and exposes all mutations.
export function useFlowData(userId) {
  const [boards, setBoards] = useState([])
  const [columns, setColumns] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedBoardId, setSelectedBoardIdState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const selectedRef = useRef(null)
  selectedRef.current = selectedBoardId

  const storageKey = userId ? `flow.selectedBoard.${userId}` : null

  const setSelectedBoardId = useCallback(
    (id) => {
      setSelectedBoardIdState(id)
      if (storageKey && id) localStorage.setItem(storageKey, id)
    },
    [storageKey],
  )

  const seedStarterColumns = useCallback(
    async (boardId) => {
      await supabase
        .from('columns')
        .insert(STARTER_COLUMNS.map((c) => ({ ...c, board_id: boardId, user_id: userId })))
    },
    [userId],
  )

  const load = useCallback(async () => {
    if (!userId) return
    setError(null)

    let boardRes = await supabase.from('boards').select('*').order('position', { ascending: true })
    if (boardRes.error) {
      setError(boardRes.error.message)
      setLoading(false)
      return
    }
    let boardData = boardRes.data || []

    // First-time user: create a default board + starter columns (race-safe).
    if (boardData.length === 0) {
      if (!seedLock) {
        seedLock = (async () => {
          const { data: board } = await supabase
            .from('boards')
            .insert({ title: 'My Board', position: 0, color: '#7c6cff', user_id: userId })
            .select()
            .single()
          if (board) await seedStarterColumns(board.id)
        })()
      }
      await seedLock
      seedLock = null
      boardRes = await supabase.from('boards').select('*').order('position', { ascending: true })
      boardData = boardRes.data || []
    }

    const [colRes, taskRes] = await Promise.all([
      supabase.from('columns').select('*').order('position', { ascending: true }),
      supabase.from('tasks').select('*').order('position', { ascending: true }),
    ])

    setBoards(boardData)
    setColumns(colRes.data || [])
    setTasks(taskRes.data || [])

    // Pick the selected board: keep current if still valid, else the stored
    // one, else the first board.
    const ids = boardData.map((b) => b.id)
    let next = selectedRef.current
    if (!next || !ids.includes(next)) {
      const stored = storageKey ? localStorage.getItem(storageKey) : null
      next = stored && ids.includes(stored) ? stored : boardData[0]?.id || null
    }
    setSelectedBoardId(next)

    setLoading(false)
  }, [userId, seedStarterColumns, storageKey, setSelectedBoardId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Realtime: refetch when boards / columns / tasks change anywhere.
  useEffect(() => {
    if (!userId) return
    let timer
    const refetch = () => {
      clearTimeout(timer)
      timer = setTimeout(() => load(), 250)
    }
    const channel = supabase
      .channel('flow-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refetch)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [userId, load])

  // ---- board operations ----
  const addBoard = useCallback(
    async (title, color) => {
      const position = boards.length
      const { data: board } = await supabase
        .from('boards')
        .insert({ title, color, position, user_id: userId })
        .select()
        .single()
      if (board) {
        await seedStarterColumns(board.id)
        setSelectedBoardId(board.id)
        await load()
      }
    },
    [boards.length, userId, seedStarterColumns, setSelectedBoardId, load],
  )

  const updateBoard = useCallback(async (id, fields) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, ...fields } : b)))
    await supabase.from('boards').update(fields).eq('id', id)
  }, [])

  const deleteBoard = useCallback(
    async (id) => {
      // Columns (and their tasks) are removed via ON DELETE CASCADE.
      const remaining = boards.filter((b) => b.id !== id)
      const removedColumnIds = new Set(columns.filter((c) => c.board_id === id).map((c) => c.id))
      setBoards(remaining)
      setColumns((prev) => prev.filter((c) => c.board_id !== id))
      setTasks((prev) => prev.filter((t) => !removedColumnIds.has(t.column_id)))
      if (selectedRef.current === id) setSelectedBoardId(remaining[0]?.id || null)
      await supabase.from('boards').delete().eq('id', id)
    },
    [boards, columns, setSelectedBoardId],
  )

  const moveBoard = useCallback(
    async (id, direction) => {
      const ordered = [...boards].sort((a, b) => a.position - b.position)
      const idx = ordered.findIndex((b) => b.id === id)
      const swapWith = idx + direction
      if (swapWith < 0 || swapWith >= ordered.length) return
      ;[ordered[idx], ordered[swapWith]] = [ordered[swapWith], ordered[idx]]
      const renumbered = ordered.map((b, i) => ({ ...b, position: i }))
      setBoards(renumbered)
      await Promise.all(
        renumbered.map((b) => supabase.from('boards').update({ position: b.position }).eq('id', b.id)),
      )
    },
    [boards],
  )

  // ---- column operations (scoped to a board) ----
  const addColumn = useCallback(
    async (boardId, title, color) => {
      const position = columns.filter((c) => c.board_id === boardId).length
      const { data } = await supabase
        .from('columns')
        .insert({ title, color, position, board_id: boardId, user_id: userId })
        .select()
        .single()
      if (data) setColumns((prev) => [...prev, data])
    },
    [columns, userId],
  )

  const updateColumn = useCallback(async (id, fields) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)))
    await supabase.from('columns').update(fields).eq('id', id)
  }, [])

  const deleteColumn = useCallback(async (id) => {
    setColumns((prev) => prev.filter((c) => c.id !== id))
    setTasks((prev) => prev.filter((t) => t.column_id !== id))
    await supabase.from('columns').delete().eq('id', id)
  }, [])

  const moveColumn = useCallback(
    async (id, direction) => {
      const col = columns.find((c) => c.id === id)
      if (!col) return
      const ordered = columns
        .filter((c) => c.board_id === col.board_id)
        .sort((a, b) => a.position - b.position)
      const idx = ordered.findIndex((c) => c.id === id)
      const swapWith = idx + direction
      if (swapWith < 0 || swapWith >= ordered.length) return
      ;[ordered[idx], ordered[swapWith]] = [ordered[swapWith], ordered[idx]]
      const renumbered = ordered.map((c, i) => ({ ...c, position: i }))
      const patch = new Map(renumbered.map((c) => [c.id, c.position]))
      setColumns((prev) =>
        prev.map((c) => (patch.has(c.id) ? { ...c, position: patch.get(c.id) } : c)),
      )
      await Promise.all(
        renumbered.map((c) => supabase.from('columns').update({ position: c.position }).eq('id', c.id)),
      )
    },
    [columns],
  )

  // ---- task operations ----
  const addTask = useCallback(
    async (columnId, fields) => {
      const position = tasks.filter((t) => t.column_id === columnId).length
      const { data } = await supabase
        .from('tasks')
        .insert({ ...fields, column_id: columnId, position, user_id: userId })
        .select()
        .single()
      if (data) setTasks((prev) => [...prev, data])
    },
    [tasks, userId],
  )

  const updateTask = useCallback(async (id, fields) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)))
    await supabase.from('tasks').update(fields).eq('id', id)
  }, [])

  const deleteTask = useCallback(async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }, [])

  // Mark a task complete: move it to the board's "Complete" bucket, stamp the
  // time + original category, and keep its notes. Newest completion goes on top.
  const completeTask = useCallback(
    async (taskId) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const fromCol = columns.find((c) => c.id === task.column_id)
      const boardId = fromCol?.board_id
      let completeCol = columns.find((c) => c.board_id === boardId && isCompleteCol(c.title))
      if (!completeCol) {
        const position = columns.filter((c) => c.board_id === boardId).length
        const { data } = await supabase
          .from('columns')
          .insert({ title: 'Complete', color: '#0d9488', position, board_id: boardId, user_id: userId })
          .select()
          .single()
        if (!data) return
        completeCol = data
        setColumns((prev) => [...prev, data])
      }
      const completedAt = new Date().toISOString()
      const completedFrom = fromCol?.title || null
      const others = tasks
        .filter((t) => t.column_id === completeCol.id && t.id !== taskId)
        .sort((a, b) => a.position - b.position)
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId)
            return {
              ...t,
              column_id: completeCol.id,
              completed_at: completedAt,
              completed_from: completedFrom,
              position: 0,
            }
          const idx = others.findIndex((o) => o.id === t.id)
          return idx >= 0 ? { ...t, position: idx + 1 } : t
        }),
      )
      await supabase
        .from('tasks')
        .update({
          column_id: completeCol.id,
          completed_at: completedAt,
          completed_from: completedFrom,
          position: 0,
        })
        .eq('id', taskId)
      await Promise.all(
        others.map((o, i) => supabase.from('tasks').update({ position: i + 1 }).eq('id', o.id)),
      )
    },
    [tasks, columns, userId],
  )

  // Reopen a completed task: clear completion and send it back to its original
  // category (if it still exists), else the first non-complete list on the board.
  const reopenTask = useCallback(
    async (taskId) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const boardId = columns.find((c) => c.id === task.column_id)?.board_id
      const boardCols = columns
        .filter((c) => c.board_id === boardId)
        .sort((a, b) => a.position - b.position)
      const target =
        boardCols.find((c) => !isCompleteCol(c.title) && c.title === task.completed_from) ||
        boardCols.find((c) => !isCompleteCol(c.title))
      if (!target) return
      const position = tasks.filter((t) => t.column_id === target.id).length
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, column_id: target.id, completed_at: null, completed_from: null, position }
            : t,
        ),
      )
      await supabase
        .from('tasks')
        .update({ column_id: target.id, completed_at: null, completed_from: null, position })
        .eq('id', taskId)
    },
    [tasks, columns],
  )

  // Persist a full re-ordering produced by drag & drop. Also stamps/clears
  // completion when a card is dragged into or out of the "Complete" bucket.
  // itemsMap: { [columnId]: [taskId, taskId, ...] }
  const reorderTasks = useCallback(
    async (itemsMap) => {
      const current = new Map(tasks.map((t) => [t.id, t]))
      const colById = new Map(columns.map((c) => [c.id, c]))
      const updates = []
      for (const [columnId, ids] of Object.entries(itemsMap)) {
        ids.forEach((taskId, position) => {
          const t = current.get(taskId)
          if (!t) return
          const movedCol = t.column_id !== columnId
          if (movedCol || t.position !== position) {
            const u = { id: taskId, column_id: columnId, position }
            if (movedCol) {
              const toComplete = isCompleteCol(colById.get(columnId)?.title)
              const fromComplete = isCompleteCol(colById.get(t.column_id)?.title)
              if (toComplete && !fromComplete) {
                u.completed_at = t.completed_at || new Date().toISOString()
                u.completed_from = colById.get(t.column_id)?.title || t.completed_from || null
              } else if (fromComplete && !toComplete) {
                u.completed_at = null
                u.completed_from = null
              }
            }
            updates.push(u)
          }
        })
      }
      if (updates.length === 0) return
      const patch = new Map(updates.map((u) => [u.id, u]))
      setTasks((prev) => prev.map((t) => (patch.has(t.id) ? { ...t, ...patch.get(t.id) } : t)))
      await Promise.all(
        updates.map((u) => {
          const fields = { column_id: u.column_id, position: u.position }
          if ('completed_at' in u) fields.completed_at = u.completed_at
          if ('completed_from' in u) fields.completed_from = u.completed_from
          return supabase.from('tasks').update(fields).eq('id', u.id)
        }),
      )
    },
    [tasks, columns],
  )

  return {
    boards,
    columns,
    tasks,
    selectedBoardId,
    setSelectedBoardId,
    loading,
    error,
    reload: load,
    addBoard,
    updateBoard,
    deleteBoard,
    moveBoard,
    addColumn,
    updateColumn,
    deleteColumn,
    moveColumn,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    reopenTask,
    reorderTasks,
  }
}
