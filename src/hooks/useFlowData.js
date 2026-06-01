import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const STARTER_COLUMNS = [
  { title: 'To Do', color: '#7c6cff', position: 0 },
  { title: 'In Progress', color: '#ff7eb6', position: 1 },
  { title: 'Done', color: '#5ad1cd', position: 2 },
]

// Central data layer for the board: loads columns + tasks, keeps them in
// sync across devices via Supabase realtime, and exposes all mutations.
export function useFlowData(userId) {
  const [columns, setColumns] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const seedingRef = useRef(false)

  const load = useCallback(async () => {
    if (!userId) return
    setError(null)
    const [colRes, taskRes] = await Promise.all([
      supabase.from('columns').select('*').order('position', { ascending: true }),
      supabase.from('tasks').select('*').order('position', { ascending: true }),
    ])

    if (colRes.error) {
      setError(colRes.error.message)
      setLoading(false)
      return
    }

    let cols = colRes.data || []

    // First-time user: create the three starter columns.
    if (cols.length === 0 && !seedingRef.current) {
      seedingRef.current = true
      const { data: seeded, error: seedErr } = await supabase
        .from('columns')
        .insert(STARTER_COLUMNS.map((c) => ({ ...c, user_id: userId })))
        .select()
      seedingRef.current = false
      if (!seedErr && seeded) cols = seeded.sort((a, b) => a.position - b.position)
    }

    setColumns(cols)
    setTasks(taskRes.data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Realtime: when anything changes (including a "dump" from Claude on another
  // device), refetch so this device stays current.
  useEffect(() => {
    if (!userId) return
    let timer
    const refetch = () => {
      clearTimeout(timer)
      timer = setTimeout(() => load(), 250)
    }
    const channel = supabase
      .channel('flow-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refetch)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [userId, load])

  // ---- column operations ----
  const addColumn = useCallback(
    async (title, color) => {
      const position = columns.length
      const { data } = await supabase
        .from('columns')
        .insert({ title, color, position, user_id: userId })
        .select()
        .single()
      if (data) setColumns((prev) => [...prev, data])
    },
    [columns.length, userId],
  )

  const updateColumn = useCallback(async (id, fields) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)))
    await supabase.from('columns').update(fields).eq('id', id)
  }, [])

  const deleteColumn = useCallback(async (id) => {
    // Tasks are removed automatically via ON DELETE CASCADE.
    setColumns((prev) => prev.filter((c) => c.id !== id))
    setTasks((prev) => prev.filter((t) => t.column_id !== id))
    await supabase.from('columns').delete().eq('id', id)
  }, [])

  const moveColumn = useCallback(
    async (id, direction) => {
      const ordered = [...columns].sort((a, b) => a.position - b.position)
      const idx = ordered.findIndex((c) => c.id === id)
      const swapWith = idx + direction
      if (swapWith < 0 || swapWith >= ordered.length) return
      ;[ordered[idx], ordered[swapWith]] = [ordered[swapWith], ordered[idx]]
      const renumbered = ordered.map((c, i) => ({ ...c, position: i }))
      setColumns(renumbered)
      await Promise.all(
        renumbered.map((c) =>
          supabase.from('columns').update({ position: c.position }).eq('id', c.id),
        ),
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

  // Persist a full re-ordering produced by drag & drop.
  // itemsMap: { [columnId]: [taskId, taskId, ...] }
  const reorderTasks = useCallback(
    async (itemsMap) => {
      const current = new Map(tasks.map((t) => [t.id, t]))
      const updates = []
      for (const [columnId, ids] of Object.entries(itemsMap)) {
        ids.forEach((taskId, position) => {
          const t = current.get(taskId)
          if (!t) return
          if (t.column_id !== columnId || t.position !== position) {
            updates.push({ id: taskId, column_id: columnId, position })
          }
        })
      }
      if (updates.length === 0) return
      const patch = new Map(updates.map((u) => [u.id, u]))
      setTasks((prev) => prev.map((t) => (patch.has(t.id) ? { ...t, ...patch.get(t.id) } : t)))
      await Promise.all(
        updates.map((u) =>
          supabase
            .from('tasks')
            .update({ column_id: u.column_id, position: u.position })
            .eq('id', u.id),
        ),
      )
    },
    [tasks],
  )

  return {
    columns,
    tasks,
    loading,
    error,
    reload: load,
    addColumn,
    updateColumn,
    deleteColumn,
    moveColumn,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
  }
}
