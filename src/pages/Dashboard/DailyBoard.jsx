import { useEffect, useRef, useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { db, isDemo } from '../../lib/dataStore'
import { bangkokDay, actionsForDay, MAIN_LINES } from '../../lib/dailyActions'
import { useUIStore } from '../../store/useUIStore'
import { Modal } from '../../components/common/Modal'
import { displayDigest } from '../../lib/controlCenter'
import { useIsMobile } from '../../hooks/useIsMobile'

const btn = { background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#374151' }
const field = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 6, padding: 10, fontSize: 14, margin: '5px 0 12px' }
const muted = { fontSize: 12, color: '#6b7280', lineHeight: 1.7 }
const band = { padding: '20px 0', borderBottom: '1px solid #e5e7eb' }
const row = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }

export function DailyBoard() {
  const mobile = useIsMobile()
  const [today, setToday] = useState(bangkokDay)
  const [historyDay, setHistoryDay] = useState('')
  const day = historyDay || today
  const historical = day !== today
  const todos = useTable('work_todos', { optional: true })
  const plans = useTable('journal_threads', { optional: true, orderBy: 'sort_order', ascending: true })
  const digest = useTable('daily_focus', { optional: true, filters: { log_date: day } })
  const [entries, setEntries] = useState([])
  const [loadedDay, setLoadedDay] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [editing, setEditing] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [line, setLine] = useState(null)
  const [planId, setPlanId] = useState(() => new URLSearchParams(location.hash.slice(1)).get('plan'))
  const [all, setAll] = useState(false)
  const [review, setReview] = useState(false)
  const setPage = useUIStore(s => s.setPage)
  const toast = useUIStore(s => s.showToast)
  useEffect(() => {
    const tick = () => setToday(bangkokDay())
    const hash = () => setPlanId(new URLSearchParams(location.hash.slice(1)).get('plan'))
    const timer = setInterval(tick, 30000)
    window.addEventListener('focus', tick); window.addEventListener('hashchange', hash)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); window.removeEventListener('hashchange', hash) }
  }, [])
  useEffect(() => {
    let live = true
    setFeedback(null); setEditing(null)
    setLoadedDay(null); setLoadError('')
    db.list('todo_day_entries', { filters: { log_date: day } }).then(data => { if (live) { setEntries(data); setLoadedDay(day) } }).catch(() => { if (live) setLoadError('本日记录暂不可读，请重试。') })
    return () => { live = false }
  }, [day, revision])
  const actions = actionsForDay(todos.rows, entries, day, historical).filter(t => !historical || t.entry || (t.done_at && bangkokDay(new Date(t.done_at)) === day))
  const pending = actions.filter(t => t.dayState === 'open')
  const done = actions.filter(t => t.dayState !== 'open')
  const ready = loadedDay === day && !todos.loading && !todos.missing
  const selectedPlan = plans.rows.find(p => p.id === planId)
  const planLink = p => <a style={{ color: '#2563eb', textUnderlineOffset: 3 }} href={`#plan=${p.id}`}>{p.title}</a>
  async function act(fn) {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try { await fn(); toast('已保存') } catch (e) { toast(`保存未完成：${e.message}`, 'error') }
    finally { lock.current = false; setBusy(false) }
  }
  async function saveEntry(todo, patch) {
    const current = (await db.list('todo_day_entries', { filters: { todo_id: todo.id, log_date: day } }))[0]
    await db.upsert('todo_day_entries', { todo_id: todo.id, log_date: day, state: current?.state || todo.dayState, feedback: current?.feedback || '', actual_minutes: current?.actual_minutes ?? null, ...patch, updated_at: new Date().toISOString() }, ['todo_id', 'log_date'])
    if ('state' in patch && !todo.repeat_weekdays?.length) await todos.patch(todo.id, { status: patch.state === 'done' ? 'done' : 'open', done_at: patch.state === 'done' ? new Date().toISOString() : null })
    setRevision(n => n + 1)
  }
  function task(todo) {
    const plan = plans.rows.find(p => p.id === todo.project_id)
    return <article key={todo.id} style={{ display: 'flex', gap: 12, padding: '15px 0', borderBottom: '1px solid #e5e7eb' }}>
      <input aria-label={`完成或撤销：${todo.title}`} type="checkbox" checked={todo.dayState === 'done'} disabled={busy || !ready || historical} style={{ width: 20, height: 20, marginTop: 5, flexShrink: 0, accentColor: '#15803d' }} onChange={() => act(() => saveEntry(todo, { state: todo.dayState === 'done' ? 'open' : 'done' }))} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={muted}>{plan ? planLink(plan) : '未关联原计划'} · {{ high: '优先', mid: '常规', low: '可选' }[todo.priority] || '常规'} · {todo.estimate_minutes ? `预计 ${todo.estimate_minutes} 分钟` : '未估时'}{todo.repeat_weekdays?.length ? ' · 每周重复' : ''}</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginTop: 5, lineHeight: 1.7, textDecoration: todo.dayState === 'done' ? 'line-through' : 'none' }}>{plan ? <a href={`#plan=${plan.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{todo.title}</a> : todo.title}</div>
        {todo.completion_criteria && <div style={muted}>做到这里即可：{todo.completion_criteria}</div>}
        {todo.due_date && !todo.repeat_weekdays?.length && <div style={{ ...muted, color: todo.due_date < day ? '#b45309' : '#6b7280' }}>原定 {todo.due_date}{todo.due_date < day ? ' · 待重新安排' : ''}</div>}
        {todo.entry?.feedback && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>反馈：{todo.entry.feedback}</p>}
        {todo.entry?.actual_minutes != null && <div style={muted}>实际 {todo.entry.actual_minutes} 分钟 · 手动记录</div>}
        {todo.dayState === 'skipped' && <div style={muted}>本日跳过</div>}
        {!historical && <div style={{ ...row, marginTop: 9 }}>
          <button style={btn} disabled={busy || !ready} onClick={() => setFeedback({ todo, text: todo.entry?.feedback || '', minutes: todo.entry?.actual_minutes ?? '' })}>反馈</button>
          <button style={btn} disabled={busy || !ready} onClick={() => setEditing({ ...todo })}>调整</button>
          <button style={btn} disabled={busy || !ready} onClick={() => act(() => saveEntry(todo, { state: todo.dayState === 'skipped' ? 'open' : 'skipped' }))}>{todo.dayState === 'skipped' ? '恢复今天' : '今日跳过'}</button>
        </div>}
      </div>
    </article>
  }
  return <div style={{ minWidth: 0, overflowWrap: 'anywhere', paddingBottom: 48 }}>
    <header style={{ ...row, justifyContent: 'space-between' }}><div><div style={muted}>{today} · 泰国时间{isDemo ? ' · 本机演示' : ''}</div><h1 style={{ fontSize: 24, letterSpacing: 0, margin: '6px 0' }}>人生看板</h1></div><button style={btn} onClick={() => setPage('journal')}>记录想法</button></header>
    <section style={band} aria-labelledby="main-lines"><h2 id="main-lines" style={{ fontSize: 17, marginTop: 0 }}>正在推进的主线</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: mobile ? 8 : 12 }}>{MAIN_LINES.map(l => <article key={l.key} style={{ padding: mobile ? 10 : 14, background: '#fff', border: '1px solid #e5e7eb', borderTop: `3px solid ${l.color}`, borderRadius: 8 }}><div style={{ ...row, justifyContent: 'space-between' }}><h3 style={{ fontSize: 16, margin: 0 }}>{l.title}</h3><button style={btn} aria-label={`${l.title}：查看计划与边界`} onClick={() => setLine(l)}>计划与边界</button></div><p style={{ fontSize: 13, lineHeight: 1.7, margin: '8px 0 0' }}>{l.boundary}</p></article>)}</div>
    </section>
    <section style={band} aria-labelledby="daily-todos"><div style={{ ...row, justifyContent: 'space-between' }}><h2 id="daily-todos" style={{ fontSize: 18 }}>今日待办</h2><div style={row}><input style={{ ...field, width: 150, margin: 0 }} aria-label="查看日期" type="date" value={day} max={today} onChange={e => { if (e.target.value) setHistoryDay(e.target.value === today ? '' : e.target.value) }} /><button style={btn} disabled={busy || !ready || historical} onClick={() => setEditing({ title: '', project_id: '', priority: 'mid', due_date: day, estimate_minutes: '', completion_criteria: '', repeat_weekdays: null })}>＋ 新增</button></div></div>
      {ready && <div style={muted}>{pending.length} 项待推进 · 已估时 {pending.reduce((n,t) => n + (t.estimate_minutes || 0), 0)} 分钟{pending.some(t => !t.estimate_minutes) ? '，另有未估时事项' : ''} · 其余时间留白{historical ? ' · 仅已记录事项' : ''}</div>}
      {!ready ? <p role="status">{loadError || (todos.missing ? '待办暂不可读' : '正在读取')} <button style={btn} onClick={() => { todos.reload(); setRevision(n => n + 1) }}>重试</button></p> : <>{pending.length === 0 && <p style={muted}>本日没有待推进事项</p>}{(all ? pending : pending.slice(0,3)).map(task)}{pending.length > 3 && <button style={{ ...btn, marginTop: 12 }} onClick={() => setAll(!all)}>{all ? '收起' : `其余 ${pending.length - 3} 项`}</button>}{done.length > 0 && <details style={{ marginTop: 16 }}><summary style={{ fontSize: 13, cursor: 'pointer' }}>完成与跳过 · {done.length}</summary>{done.map(task)}</details>}</>}
    </section>
    <section style={band}><div style={{ ...row, justifyContent: 'space-between' }}><h2 style={{ fontSize: 17 }}>记录与复盘</h2><button style={btn} onClick={() => setReview(!review)}>{review ? '收起' : '查看本日'}</button></div>{review && <div style={{ fontSize: 14, lineHeight: 1.8 }}><p>完成 {actions.filter(t => t.dayState === 'done').length} 项 · 待继续 {pending.length} 项 · 跳过 {actions.filter(t => t.dayState === 'skipped').length} 项</p><p style={muted}>实际时间与反馈来自手动记录；完成数量不等于收益，未记录的原因保持未知。</p>{actions.filter(t => t.entry?.feedback).map(t => <p key={t.id}><strong>{t.title}</strong><br />{t.entry.feedback}</p>)}{pending.length > 0 && <p>明日调整建议：先检查「{pending[0].title}」的完成标准与外部依赖，再决定继续、缩小或延期。</p>}{digest.missing ? <p>项目汇总暂不可读</p> : digest.rows.length === 0 ? <p style={muted}>本日尚无汇总，不能据此判断项目无进展。</p> : digest.rows.map(r => <details key={r.id}><summary>{r.track} · {r.win || '当日记录'}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{displayDigest(r.content)}</p></details>)}</div>}</section>
    <footer style={{ ...row, marginTop: 20 }}><button style={btn} onClick={() => setPage('overview')}>生活概览</button><button style={btn} onClick={() => setPage('journal')}>全部主线与记录</button><span style={muted}>已保存记录 · 非 Codex 实时同步</span></footer>
    {line && <Modal title={line.title} onClose={() => setLine(null)}><p style={{ lineHeight: 1.8 }}>{line.detail}</p>{plans.loading ? <p>读取中</p> : plans.missing ? <p>计划暂不可读</p> : plans.rows.filter(p => p.track === line.key).map(p => <p key={p.id} onClick={() => setLine(null)}>{planLink(p)}</p>)}</Modal>}
    {planId && <Modal title={selectedPlan?.title || '项目原计划'} width={760} onClose={() => { history.replaceState(null, '', location.pathname + location.search); setPlanId(null) }}>{plans.loading ? <p>读取中</p> : !selectedPlan ? <p>未找到该计划或暂不可读。</p> : <><p style={muted}>已保存计划 · 更新 {new Date(selectedPlan.updated_at || selectedPlan.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Bangkok' })}（泰国时间）</p><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: 14 }}>{selectedPlan.summary || '原计划待补充'}</p><h3 style={{ fontSize: 15 }}>下一步</h3><p>{selectedPlan.next_action || '待明确'}</p><h3 style={{ fontSize: 15 }}>本期边界</h3><p style={{ lineHeight: 1.8 }}>{MAIN_LINES.find(l => l.key === selectedPlan.track)?.detail}</p></>}</Modal>}
    {feedback && <Modal title="本次反馈" onClose={() => setFeedback(null)}><form onSubmit={e => { e.preventDefault(); act(async () => { await saveEntry(feedback.todo, { feedback: feedback.text.trim(), actual_minutes: feedback.minutes === '' ? null : Number(feedback.minutes) }); setFeedback(null) }) }}><label>一句话反馈（可选）<textarea aria-label="一句话反馈" style={field} rows={4} maxLength={2000} value={feedback.text} onChange={e => setFeedback({ ...feedback, text: e.target.value })} /></label><label>实际分钟（可选）<input style={field} type="number" min="0" max="1440" step="1" value={feedback.minutes} onChange={e => setFeedback({ ...feedback, minutes: e.target.value })} /></label><button style={btn} disabled={busy || historical || !ready}>保存反馈</button></form></Modal>}
    {editing && <Modal title={editing.id ? '调整事项' : '新增事项'} onClose={() => setEditing(null)}><form onSubmit={e => { e.preventDefault(); act(async () => {
      const data = { title: editing.title.trim(), project_id: editing.project_id || null, priority: editing.priority, due_date: editing.due_date || null, estimate_minutes: editing.estimate_minutes === '' || editing.estimate_minutes == null ? null : Number(editing.estimate_minutes), completion_criteria: editing.completion_criteria || '', repeat_weekdays: editing.repeat_weekdays?.length ? editing.repeat_weekdays : null }
      if (editing.id) await todos.patch(editing.id, data); else await todos.add({ ...data, status: 'open' }); setEditing(null)
    }) }}>
      <label>具体事项<input style={field} required maxLength={300} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></label>
      <label>所属原计划<select style={field} value={editing.project_id || ''} onChange={e => setEditing({ ...editing, project_id: e.target.value })}><option value="">暂不关联</option>{plans.rows.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <label>优先级<select style={field} value={editing.priority} onChange={e => setEditing({ ...editing, priority: e.target.value })}><option value="high">优先</option><option value="mid">常规</option><option value="low">可选</option></select></label>
      <label>日期／重复起始日<input style={field} type="date" value={editing.due_date || ''} onChange={e => setEditing({ ...editing, due_date: e.target.value })} /></label>
      <label>预计分钟<input style={field} type="number" min="1" max="1440" step="1" value={editing.estimate_minutes ?? ''} onChange={e => setEditing({ ...editing, estimate_minutes: e.target.value })} /></label>
      <label>做到什么程度即可<textarea style={field} rows={2} maxLength={1000} value={editing.completion_criteria || ''} onChange={e => setEditing({ ...editing, completion_criteria: e.target.value })} /></label>
      <fieldset style={{ border: 0, padding: '8px 0 16px', ...row }}><legend>重复日（不选为单次）</legend>{['日','一','二','三','四','五','六'].map((d,i) => <label key={d}><input type="checkbox" checked={editing.repeat_weekdays?.includes(i) || false} onChange={e => setEditing({ ...editing, repeat_weekdays: e.target.checked ? [...(editing.repeat_weekdays || []), i] : editing.repeat_weekdays.filter(n => n !== i) })} />{d}</label>)}</fieldset>
      <button style={btn} disabled={busy || !editing.title.trim()}>保存事项</button>
    </form></Modal>}
  </div>
}
