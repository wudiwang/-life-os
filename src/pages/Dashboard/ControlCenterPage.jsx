import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, FOCUS_TRACKS } from '../../lib/constants'
import { activeProjects, displayDigest, nextTodos } from '../../lib/controlCenter'
import { todayStr, fmtDate } from '../../lib/date'
import { useUIStore } from '../../store/useUIStore'
import { isDemo } from '../../lib/dataStore'

const button = { border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.text, borderRadius: 8, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }
const input = { width: '100%', minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, fontSize: 14, color: COLORS.text, background: '#fff' }
const section = { padding: '20px 0', borderBottom: `1px solid ${COLORS.border}` }

export function ControlCenterPage() {
  const today = todayStr()
  const setPage = useUIStore(s => s.setPage)
  const showToast = useUIStore(s => s.showToast)
  const todos = useTable('work_todos', { optional: true })
  const projects = useTable('journal_threads', { optional: true, orderBy: 'sort_order', ascending: true })
  const digest = useTable('daily_focus', { optional: true, filters: { log_date: today } })
  const [newAction, setNewAction] = useState('')
  const [busy, setBusy] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const actions = nextTodos(todos.rows, today)
  const visibleActions = showAll ? actions : actions.slice(0, 3)
  const liveProjects = activeProjects(projects.rows)
  const updates = digest.rows.filter(row => row.content?.trim() || row.win?.trim())
  const doneToday = todos.rows.filter(row => row.status === 'done' && row.done_at && new Date(row.done_at).toLocaleDateString('sv-SE') === today).length

  async function act(key, action) {
    if (busy) return
    setBusy(key)
    try { await action() } catch { /* useTable shows the storage error. */ }
    finally { setBusy(null) }
  }

  return (
    <div style={{ minWidth: 0, overflowWrap: 'anywhere', paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: COLORS.textLight, fontSize: 13 }}>{fmtDate(today)}{isDemo ? ' · 本机演示数据' : ''}</div>
          <h1 style={{ fontSize: 24, margin: '6px 0', letterSpacing: 0 }}>今天，先做好一件事</h1>
        </div>
        <button style={{ ...button, background: COLORS.primary, color: '#fff', borderColor: COLORS.primary }} onClick={() => setPage('journal')}>记录想法</button>
      </div>

      <section style={section} aria-labelledby="today-actions">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 id="today-actions" style={{ fontSize: 17 }}>今天先做</h2>
          <span style={{ color: COLORS.textLight, fontSize: 13 }}>今日完成 {doneToday}</span>
        </div>
        {todos.loading ? <p role="status">正在读取待办…</p> : todos.missing ? <Unavailable onRetry={todos.reload} /> : <>
          {visibleActions.length === 0 && <p style={{ color: COLORS.textLight }}>暂无待办</p>}
          {visibleActions.map((todo, i) => (
            <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: `1px solid ${COLORS.border}` }}>
              <input type="checkbox" checked={false} disabled={Boolean(busy)} aria-label={`完成：${todo.title}`}
                style={{ width: 20, height: 20, flexShrink: 0, accentColor: COLORS.green }}
                onChange={() => act(todo.id, async () => {
                  await todos.patch(todo.id, { status: 'done', done_at: new Date().toISOString() })
                  showToast('已完成')
                })} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: i === 0 ? 600 : 400 }}>{todo.title}</div>
                <div style={{ fontSize: 12, color: todo.due_date && todo.due_date < today ? COLORS.red : COLORS.textLight, marginTop: 4 }}>
                  {todo.priority === 'high' ? '高优先级' : '待推进'}{todo.due_date ? ` · ${todo.due_date < today ? '已过期 ' : ''}${fmtDate(todo.due_date)}` : ''}
                </div>
              </div>
            </div>
          ))}
          {actions.length > 3 && <button style={{ ...button, marginTop: 12 }} onClick={() => setShowAll(v => !v)}>{showAll ? '收起' : `全部 ${actions.length} 项`}</button>}
          <form onSubmit={e => { e.preventDefault(); if (newAction.trim()) act('new', async () => {
            await todos.add({ title: newAction.trim(), priority: 'mid', status: 'open', due_date: today })
            setNewAction('')
          }) }} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input style={input} aria-label="新增今日事项" placeholder="下一步要做什么" value={newAction} maxLength={300} onChange={e => setNewAction(e.target.value)} />
            <button style={{ ...button, flexShrink: 0 }} disabled={Boolean(busy) || !newAction.trim()}>加入今天</button>
          </form>
        </>}
      </section>

      <section style={section} aria-labelledby="project-status">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="project-status" style={{ fontSize: 17 }}>正在推进的主线</h2>
          <button style={button} onClick={() => setPage('journal')}>管理主线</button>
        </div>
        {projects.loading ? <p role="status">正在读取主线…</p> : projects.missing ? <Unavailable onRetry={projects.reload} /> : <>
          {!liveProjects.length && <p style={{ color: COLORS.textLight }}>暂无进行中的主线</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
            {liveProjects.map(project => {
              const track = FOCUS_TRACKS.find(t => t.key === project.track)
              const editing = editProject?.id === project.id
              return <article key={project.id} style={{ border: `1px solid ${COLORS.border}`, borderTop: `3px solid ${track?.color || COLORS.teal}`, borderRadius: 8, background: '#fff', padding: 16, minWidth: 0 }}>
                <div style={{ color: COLORS.textLight, fontSize: 12 }}>{track?.short || '其他'} · {project.last_noted_at ? `最近记录 ${fmtDate(project.last_noted_at)}` : '尚无关联记录'}</div>
                <h3 style={{ fontSize: 16, margin: '10px 0' }}>{project.title}</h3>
                {project.summary && <p style={{ fontSize: 13, lineHeight: 1.7, color: COLORS.textLight, whiteSpace: 'pre-wrap' }}>{project.summary}</p>}
                {editing ? <form onSubmit={e => { e.preventDefault(); act(project.id, async () => {
                  await projects.patch(project.id, { next_action: editProject.next_action.trim(), updated_at: new Date().toISOString() })
                  setEditProject(null)
                }) }}>
                  <textarea style={input} rows={3} aria-label={`${project.title}的下一步`} value={editProject.next_action} onChange={e => setEditProject({ ...editProject, next_action: e.target.value })} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button style={button} disabled={Boolean(busy)}>保存</button>
                    <button type="button" style={button} disabled={Boolean(busy)} onClick={() => setEditProject(null)}>取消</button>
                  </div>
                </form> : <>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}><strong>下一步</strong><br />{project.next_action || '待确定'}</p>
                  <button style={button} onClick={() => setEditProject({ id: project.id, next_action: project.next_action || '' })}>调整下一步</button>
                </>}
              </article>
            })}
          </div>
        </>}
      </section>

      <section style={section} aria-labelledby="today-digest">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 id="today-digest" style={{ fontSize: 17 }}>今天的记录</h2>
          <button style={button} onClick={() => digest.reload()}>刷新</button>
        </div>
        {digest.loading ? <p role="status">正在读取记录…</p> : digest.missing ? <Unavailable onRetry={digest.reload} /> : <>
          {!updates.length && <p style={{ color: COLORS.textLight }}>今天尚未收到汇总</p>}
          {updates.map(row => <article key={row.id} style={{ padding: '12px 0', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 13, color: COLORS.textLight }}>{FOCUS_TRACKS.find(t => t.key === row.track)?.short || row.track}</div>
            {row.win && <p style={{ fontWeight: 600, color: COLORS.green }}>{row.win}</p>}
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 14 }}>{displayDigest(row.content)}</p>
          </article>)}
        </>}
      </section>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
        <button style={button} onClick={() => setPage('journal')}>补充今天</button>
        <button style={button} onClick={() => setPage('overview')}>生活概览</button>
        <button style={button} onClick={() => setPage('okr')}>回看目标</button>
      </div>
    </div>
  )
}

function Unavailable({ onRetry }) {
  return <div role="alert" style={{ padding: '12px 0', color: COLORS.red }}>暂时无法读取数据 <button style={button} onClick={onRetry}>重试</button></div>
}
