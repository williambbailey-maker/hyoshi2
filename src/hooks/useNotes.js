import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Data layer for the Curate module: a synced list of notes (newest first).
export function useNotes(userId) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error: err } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setNotes(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Realtime: reflect notes dropped in from anywhere (e.g. a Claude "curate").
  useEffect(() => {
    if (!userId) return
    let timer
    const refetch = () => {
      clearTimeout(timer)
      timer = setTimeout(() => load(), 250)
    }
    const channel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, refetch)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [userId, load])

  const addNote = useCallback(
    async (title, body) => {
      const { data } = await supabase
        .from('notes')
        .insert({ title, body: body || null, user_id: userId })
        .select()
        .single()
      if (data) setNotes((prev) => [data, ...prev])
    },
    [userId],
  )

  const updateNote = useCallback(async (id, fields) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...fields } : n)))
    await supabase.from('notes').update(fields).eq('id', id)
  }, [])

  const deleteNote = useCallback(async (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('notes').delete().eq('id', id)
  }, [])

  return { notes, loading, error, addNote, updateNote, deleteNote }
}
