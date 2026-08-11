import { useMemo, useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS, trackOf } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { TableMissing } from '../../components/common/TableMissing'
import { todayStr, thisWeekDays, weekdayIndex } from '../../lib/date'
import { useUIStore } from '../../store/useUIStore'

const WD = ['一', '二', '三', '四', '五', '六', '日']

// 本周行为契约打卡。
// 只考核「动作做没做」——二元判定，无法自欺；结果指标留给 OKR 页回顾时看。
export function WeeklyActionsCard() {
  const isMobile = useIsMobile()
  const setPage = useUIStore(s => s.setPage)
  const { rows: actions, missing } = useTable('weekly_actions', {
    orderBy: 'sort_order', ascending: true, optional: true,
  })
  const { rows: logs, add, del } = useTable('weekly_action_logs', {
    orderBy: 'log_date', ascending: false, limit: 400, optional: true,
  })
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(null)

  const today = todayStr()
  const week = useMemo(() => thisWeekDays(), [])
  const active = actions.filter(a => a.active !== false)

  // action_id -> Map(log_date -> row)
  const byAction = useMemo(() => {
    const m = new Map()
    logs.forEach(l => {
      if (!m.has(l.action_id)) m.set(l.action_id, new Map())
      m.get(l.action_id).set(l.log_date, l)
    })
    return m
  }, [logs])

  const doneThisWeek = a => week.filter(d => byAction.get(a.id)?.has(d)).length

  const toggle = async (a, date) => {
    if (date > today) return // 不能提前打卡
    const key = `${a.id}-${date}`
    setBusy(key)
    try {
      const existing = byAction.get(a.id)?.get(date)
      if (existing) await del(existing.id)
      else await add({ action_id: a.id, log_date: date })
    } finally {
      setBusy(null)
    }
  }

  const totalTarget = active.reduce((s, a) => s + (a.per_week || 1), 0)
  const totalDone = active.reduce((s, a) => s + Math.min(doneThisWeek(a), a.per_week || 1), 0)

  // 今天该做但还没做的
  const dueToday = active.filter(a => {
    if (byAction.get(a.id)?.has(today)) return false
    if (a.weekdays) return a.weekdays.split(',').map(s => s.trim()).includes(String(weekdayIndex(today)))
    return doneThisWeek(a) < (a.per_week || 1)
  })

  return (
    <Card
      title="📋 本周行为契约"
      extra={
        <span style={{ fontSize: 13, color: COLORS.textLight }}>
          <b style={{
            fontSize: 16,
            color: totalTarget && totalDone >= totalTarget ? COLORS.green : COLORS.primary,
          }}>{totalDone}</b>
          {' / '}{totalTarget}
          <button onClick={() => setPage('okr')} style={{
            border: 'none', background: 'none', color: COLORS.primary, fontSize: 13, marginLeft: 8,
          }}>管理 →</button>
        </span>
      }
    >
      {missing ? <TableMissing sql="v8_okr_commitments.sql" /> : active.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.7 }}>
          还没有行为契约。去「人生 OKR」加几条——
          <b>只考核动作做没做，不考核结果达没达</b>，这是它能跑下去的原因。
        </div>
      ) : (
        <>
          {dueToday.length > 0 && (
            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
              padding: '8px 12px', fontSize: 13, marginBottom: 12, lineHeight: 1.7,
            }}>
              今天还差：{dueToday.map(a => a.title).join('、')}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {active.map(a => {
              const t = trackOf(a.track)
              const n = doneThisWeek(a)
              const target = a.per_week || 1
              const hit = n >= target
              return (
                <div key={a.id} style={{ padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}>
                    <span style={{ fontSize: 14 }}>{t.icon}</span>
                    <span
                      onClick={() => setOpen(open === a.id ? null : a.id)}
                      style={{
                        flex: 1, minWidth: isMobile ? '60%' : 0, fontSize: 14, fontWeight: 500,
                        cursor: a.detail ? 'pointer' : 'default',
                      }}
                    >
                      {a.title}
                      {a.detail && (
                        <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: 6 }}>
                          {open === a.id ? '收起' : '怎么做'}
                        </span>
                      )}
                    </span>

                    {/* 本周 7 格 */}
                    <div style={{ display: 'flex', gap: 3 }}>
                      {week.map((d, i) => {
                        const done = byAction.get(a.id)?.has(d)
                        const future = d > today
                        const isToday = d === today
                        return (
                          <button
                            key={d}
                            disabled={future || busy === `${a.id}-${d}`}
                            onClick={() => toggle(a, d)}
                            title={`${WD[i]} ${d}`}
                            style={{
                              width: 22, height: 22, borderRadius: 6, fontSize: 10, padding: 0,
                              border: isToday ? `2px solid ${t.color}` : `1px solid ${COLORS.border}`,
                              background: done ? t.color : future ? COLORS.bg : '#fff',
                              color: done ? '#fff' : future ? COLORS.border : COLORS.textLight,
                              cursor: future ? 'default' : 'pointer',
                            }}
                          >{done ? '✓' : WD[i]}</button>
                        )
                      })}
                    </div>

                    <span style={{
                      fontSize: 12, width: 34, textAlign: 'right',
                      color: hit ? COLORS.green : COLORS.textLight, fontWeight: hit ? 600 : 400,
                    }}>{n}/{target}</span>
                  </div>

                  {open === a.id && a.detail && (
                    <div style={{
                      fontSize: 13, color: COLORS.text, lineHeight: 1.8, whiteSpace: 'pre-wrap',
                      background: t.color + '0D', borderRadius: 8, padding: '10px 12px', marginTop: 8,
                    }}>{a.detail}</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
