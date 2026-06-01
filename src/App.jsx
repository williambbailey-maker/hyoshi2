import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useFlowData } from './hooks/useFlowData'
import Auth from './components/Auth'
import Board from './components/Board'
import CalendarView from './components/CalendarView'
import EditSheet from './components/EditSheet'
import ColumnSheet from './components/ColumnSheet'
import AccountSheet from './components/AccountSheet'

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!authReady) {
    return (
      <div id="app">
        <div className="center-state">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  if (!session) return <Auth />

  return <FlowApp session={session} />
}

function FlowApp({ session }) {
  const userId = session.user.id
  const {
    columns,
    tasks,
    loading,
    error,
    addColumn,
    updateColumn,
    deleteColumn,
    moveColumn,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
  } = useFlowData(userId)

  const [view, setView] = useState('board') // 'board' | 'schedule'
  const [taskEditing, setTaskEditing] = useState(null)
  const [colEditing, setColEditing] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)

  const email = session.user.email || ''
  const initials = email.slice(0, 2).toUpperCase()
  const doneCount = (() => {
    const doneCol = columns.find((c) => /done/i.test(c.title))
    return doneCol ? tasks.filter((t) => t.column_id === doneCol.id).length : 0
  })()

  function openColumnMenu(column) {
    const ordered = [...columns].sort((a, b) => a.position - b.position)
    setColEditing({
      mode: 'edit',
      column,
      index: ordered.findIndex((c) => c.id === column.id),
      total: ordered.length,
    })
  }

  return (
    <div id="app">
      <header>
        <div className="brand">
          <h1>Flow</h1>
          <p>
            {loading
              ? 'Loading…'
              : `${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${doneCount} done`}
          </p>
        </div>
        <div className="header-right">
          <div className="segmented">
            <button
              className={view === 'board' ? 'active' : ''}
              onClick={() => setView('board')}
            >
              Board
            </button>
            <button
              className={view === 'schedule' ? 'active' : ''}
              onClick={() => setView('schedule')}
            >
              Schedule
            </button>
          </div>
          <button className="avatar" onClick={() => setAccountOpen(true)}>
            {initials}
          </button>
        </div>
      </header>

      {error ? (
        <div className="center-state">
          <div className="big">Couldn’t load your board</div>
          <div>{error}</div>
        </div>
      ) : loading ? (
        <div className="center-state">
          <div className="spinner" />
        </div>
      ) : view === 'board' ? (
        <>
          <Board
            columns={columns}
            tasks={tasks}
            onReorder={reorderTasks}
            onAddTask={(columnId) => setTaskEditing({ mode: 'new', columnId })}
            onCardClick={(task) => setTaskEditing({ mode: 'edit', task })}
            onColumnMenu={openColumnMenu}
            onAddColumn={() => setColEditing({ mode: 'new' })}
          />
          <div className="hint">Tap a card to edit · press &amp; hold to drag · swipe for more</div>
        </>
      ) : (
        <CalendarView
          tasks={tasks}
          columns={columns}
          onCardClick={(task) => setTaskEditing({ mode: 'edit', task })}
        />
      )}

      <EditSheet
        editing={taskEditing}
        onClose={() => setTaskEditing(null)}
        onCreate={addTask}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />

      <ColumnSheet
        editing={colEditing}
        onClose={() => setColEditing(null)}
        onCreate={addColumn}
        onUpdate={updateColumn}
        onDelete={deleteColumn}
        onMove={moveColumn}
      />

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} email={email} />
    </div>
  )
}
