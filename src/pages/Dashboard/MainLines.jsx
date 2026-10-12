// 三大主线卡片（用户 2026-10-13）：首页主体。
// 结构：主线 → 项目(journal_threads.main_line) → 需求单(work_todos.parent_id is null)
//       → 子任务(work_todos.parent_id)。
// 设计目标是「少字 + 可视化 + 一眼看懂」：每张卡只有一个大进度环、三个数字、
// 今天要做的几件事（可直接勾）、近 7 天的打卡点阵。不放长段文字。
import { useMemo, useState } from 'react'

import { useIsMobile } from '../../hooks/useIsMobile'
import { useTable } from '../../hooks/useTable'
import { COLORS, THREE_LINES } from '../../lib/constants'
import { actionsForDay, bangkokDay } from '../../lib/dailyActions'
import { db } from '../../lib/dataStore'
import { useUIStore } from '../../store/useUIStore'

/** 环形进度：纯 SVG，无依赖。 */
function Ring({ done, total, color, size = 62 }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.border} strokeWidth="6" />
        {total > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontSize: total > 0 ? 15 : 13, fontWeight: 700,
        color: total > 0 ? color : COLORS.textLight,
      }}>{total > 0 ? `${done}/${total}` : '—'}</div>
    </div>
  )
}

/** 近 7 天点阵：实心=当天有完成，空心=有任务没做，灰点=当天无任务。 */
function WeekDots({ days, color }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {days.map(d => (
        <span key={d.day} title={`${d.day} 完成 ${d.done}/${d.total}`} style={{
          width: 9, height: 9, borderRadius: '50%', flex: 'none',
          background: d.total === 0 ? COLORS.border : d.done > 0 ? color : 'transparent',
          border: d.total > 0 && d.done === 0 ? `1.5px solid ${color}66` : 'none',
          opacity: d.total === 0 ? 0.45 : 1,
        }} />
      ))}
    </div>
  )
}

export function MainLines() {
  const isMobile = useIsMobile()
  const setPage = useUIStore(s => s.setPage)
  const showToast = useUIStore(s => s.showToast)
  const threads = useTable('journal_threads', { optional: true })
  const todos = useTable('work_todos')
  const entries = useTable('todo_day_entries', {
    optional: true, orderBy: 'log_date', ascending: false, limit: 400,
  })
  const [busy, setBusy] = useState(null)
  const loading = threads.loading || todos.loading || entries.loading

  const today = bangkokDay()
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  }), [today])

  const lines = useMemo(() => THREE_LINES.map(line => {
    const projects = threads.rows.filter(t => t.main_line === line.key && t.status !== 'done')
    const ids = new Set(projects.map(p => p.id))
    const mine = todos.rows.filter(t => ids.has(t.project_id))
    const demands = mine.filter(t => !t.parent_id)
    const subs = mine.filter(t => t.parent_id)
    const todayActions = actionsForDay(mine, entries.rows, today)
    return {
      ...line, projects, demands, subs, todayActions,
      doneToday: todayActions.filter(a => a.dayState === 'done').length,
      subsDone: subs.filter(t => t.status === 'done').length,
      week: last7.map(day => {
        const acts = actionsForDay(mine, entries.rows, day, true)
        return { day, total: acts.length, done: acts.filter(a => a.dayState === 'done').length }
      }),
    }
  }), [threads.rows, todos.rows, entries.rows, today, last7])

  async function toggle(todo) {
    if (busy) return
    setBusy(todo.id)
    try {
      const cur = (await db.list('todo_day_entries', {
        filters: { todo_id: todo.id, log_date: today },
      }))[0]
      const next = todo.dayState === 'done' ? 'open' : 'done'
      await db.upsert('todo_day_entries', {
        todo_id: todo.id, log_date: today, state: next,
        feedback: cur?.feedback || '', actual_minutes: cur?.actual_minutes ?? null,
        updated_at: new Date().toISOString(),
      }, ['todo_id', 'log_date'])
      if (!todo.repeat_weekdays?.length) {
        await todos.patch(todo.id, {
          status: next === 'done' ? 'done' : 'open',
          done_at: next === 'done' ? new Date().toISOString() : null,
        })
      }
      await entries.reload()
      showToast('已保存')
    } catch (e) {
      showToast(`保存未完成：${e.message}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{
      display: 'grid', gap: isMobile ? 12 : 14,
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    }}>
      {lines.map(line => (
        <article key={line.key} style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderTop: `3px solid ${line.color}`, borderRadius: 12,
          padding: isMobile ? '14px 15px' : '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>{line.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{line.name}</div>
              <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 1 }}>{line.tagline}</div>
            </div>
          </header>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Ring done={line.doneToday} total={loading ? 0 : line.todayActions.length} color={line.color} />
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              fontSize: 12.5, color: COLORS.textLight,
            }}>
              <div><b style={{ color: COLORS.text, fontSize: 15 }}>{loading ? '·' : line.projects.length}</b> 项目</div>
              <div><b style={{ color: COLORS.text, fontSize: 15 }}>{loading ? '·' : line.demands.length}</b> 需求单</div>
              <div><b style={{ color: COLORS.text, fontSize: 15 }}>{loading ? '·' : `${line.subsDone}/${line.subs.length}`}</b> 子任务</div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
            <div style={{
              fontSize: 11, letterSpacing: 1, color: COLORS.textLight, marginBottom: 7,
            }}>今 天</div>
            {loading ? (
              <div style={{ fontSize: 12.5, color: COLORS.textLight }}>读取中…</div>
            ) : line.todayActions.length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLORS.textLight }}>今天没有安排</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {line.todayActions.slice(0, 4).map(a => (
                  <label key={a.id} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    fontSize: 13, lineHeight: 1.55, cursor: 'pointer',
                    opacity: busy === a.id ? 0.5 : 1,
                  }}>
                    <input type="checkbox" checked={a.dayState === 'done'} disabled={!!busy}
                      onChange={() => toggle(a)} aria-label={`完成或撤销：${a.title}`}
                      style={{ width: 16, height: 16, marginTop: 2, flex: 'none', accentColor: line.color }} />
                    <span style={{
                      color: a.dayState === 'done' ? COLORS.textLight : COLORS.text,
                      textDecoration: a.dayState === 'done' ? 'line-through' : 'none',
                    }}>{a.title}</span>
                  </label>
                ))}
                {line.todayActions.length > 4 && (
                  <div style={{ fontSize: 12, color: COLORS.textLight }}>
                    还有 {line.todayActions.length - 4} 项…
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{
            marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${COLORS.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <WeekDots days={line.week} color={line.color} />
            <button onClick={() => setPage(line.page)} style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, color: line.color, fontWeight: 600, padding: 0,
            }}>展开 →</button>
          </div>
        </article>
      ))}
    </div>
  )
}
