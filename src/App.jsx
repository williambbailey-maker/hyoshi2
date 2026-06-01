import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { useFlowData } from './hooks/useFlowData'
import Auth from './components/Auth'
import Board from './components/Board'
import BoardSwitcher from './components/BoardSwitcher'
import ScheduleView from './components/ScheduleView'
import EditSheet from './components/EditSheet'
import ColumnSheet from './components/ColumnSheet'
import BoardSheet from './components/BoardSheet'
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
    boards,
    columns,
    tasks,
    selectedBoardId,
    setSelectedBoardId,
    loading,
    error,
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
    reorderTasks,
  } = useFlowData(userId)

  const [view, setView] = useState('schedule') // 'board' | 'schedule' (open on calendar)
  const [taskEditing, setTaskEditing] = useState(null)
  const [colEditing, setColEditing] = useState(null)
  const [boardEditing, setBoardEditing] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)

  // Scope everything to the currently selected board.
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.board_id === selectedBoardId),
    [columns, selectedBoardId],
  )
  const visibleTasks = useMemo(() => {
    const ids = new Set(visibleColumns.map((c) => c.id))
    return tasks.filter((t) => ids.has(t.column_id))
  }, [tasks, visibleColumns])

  const email = session.user.email || ''
  const initials = email.slice(0, 2).toUpperCase()
  const doneCount = useMemo(() => {
    const doneCol = visibleColumns.find((c) => /done/i.test(c.title))
    return doneCol ? visibleTasks.filter((t) => t.column_id === doneCol.id).length : 0
  }, [visibleColumns, visibleTasks])

  function openColumnMenu(column) {
    const ordered = visibleColumns.slice().sort((a, b) => a.position - b.position)
    setColEditing({
      mode: 'edit',
      column,
      index: ordered.findIndex((c) => c.id === column.id),
      total: ordered.length,
    })
  }

  function openBoardMenu(board) {
    const ordered = boards.slice().sort((a, b) => a.position - b.position)
    setBoardEditing({
      mode: 'edit',
      board,
      index: ordered.findIndex((b) => b.id === board.id),
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
              : `${visibleTasks.length} task${visibleTasks.length === 1 ? '' : 's'} · ${doneCount} done`}
          </p>
        </div>
        <div className="header-right">
          <div className="segmented">
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
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

      {view === 'board' && !loading && !error && boards.length > 0 && (
        <BoardSwitcher
          boards={boards}
          selectedId={selectedBoardId}
          onSelect={setSelectedBoardId}
          onEdit={openBoardMenu}
          onAdd={() => setBoardEditing({ mode: 'new' })}
        />
      )}

      {view === 'schedule' ? (
        <ScheduleView />
      ) : error ? (
        <div className="center-state">
          <div className="big">Couldn’t load your boards</div>
          <div>{error}</div>
        </div>
      ) : loading ? (
        <div className="center-state">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <Board
            columns={visibleColumns}
            tasks={visibleTasks}
            onReorder={reorderTasks}
            onAddTask={(columnId) => setTaskEditing({ mode: 'new', columnId })}
            onCardClick={(task) => setTaskEditing({ mode: 'edit', task })}
            onColumnMenu={openColumnMenu}
            onAddColumn={() => setColEditing({ mode: 'new' })}
          />
          <div className="hint">Tap a card to edit · press &amp; hold to drag · swipe for more</div>
        </>
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
        onCreate={(title, color) => addColumn(selectedBoardId, title, color)}
        onUpdate={updateColumn}
        onDelete={deleteColumn}
        onMove={moveColumn}
      />

      <BoardSheet
        editing={boardEditing}
        onClose={() => setBoardEditing(null)}
        onCreate={addBoard}
        onUpdate={updateBoard}
        onDelete={deleteBoard}
        onMove={moveBoard}
      />

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} email={email} />
    </div>
  )
}
