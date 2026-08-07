import { useMemo, useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS, FOCUS_TRACKS } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextArea, TextInput } from '../../components/common/FormField'
import { Badge } from '../../components/common/Badge'
import { todayStr, addDays, lastNDays } from '../../lib/date'

// 空记录不算打卡：思考和成就都空的行视为没写
const filled = r => Boolean((r?.content || '').trim() || (r?.win || '').trim())

export function DailyFocusCard() {
  const isMobile = useIsMobile()
  const { rows, add, patch } = useTable('daily_focus', { orderBy: 'log_date', ascending: false, limit: 300 })
  const [editing, setEditing] = useState(null)

  const today = todayStr()
  const days = useMemo(() => lastNDays(7), [])

  // track -> Map(log_date -> row)，只收有内容的
  const byTrack = useMemo(() => {
    const m = {}
    FOCUS_TRACKS.forEach(t => { m[t.key] = new Map() })
    rows.forEach(r => {
      if (!m[r.track] || !filled(r)) return
      m[r.track].set(r.log_date, r)
    })
    return m
  }, [rows])

  const streak = track => {
    const map = byTrack[track]
    if (!map) return 0
    let n = 0
    let d = today
    if (!map.has(d)) d = addDays(d, -1) // 今天还没写不算断
    while (map.has(d)) { n++; d = addDays(d, -1) }
    return n
  }

  const openTrack = t => {
    const row = rows.find(r => r.track === t.key && r.log_date === today)
    setEditing({ track: t.key, id: row?.id, content: row?.content || '', win: row?.win || '' })
  }

  const save = async () => {
    const { id, track, content, win } = editing
    if (id) await patch(id, { content, win, updated_at: new Date().toISOString() })
    else await add({ track, log_date: today, content, win })
    setEditing(null)
  }

  const doneToday = FOCUS_TRACKS.filter(t => byTrack[t.key]?.has(today)).length
  const editTrack = editing && FOCUS_TRACKS.find(t => t.key === editing.track)

  // 近 7 天的成就流水（跨方向合并，最新在前）
  const recentWins = rows
    .filter(r => (r.win || '').trim() && r.log_date >= days[0])
    .slice(0, 6)

  return (
    <Card
      title="🧭 每日三向"
      extra={
        <span style={{ fontSize: 13, color: doneToday === FOCUS_TRACKS.length ? COLORS.green : COLORS.textLight }}>
          今日 <b style={{ fontSize: 16, color: doneToday === FOCUS_TRACKS.length ? COLORS.green : COLORS.primary }}>{doneToday}</b>
          {' / '}{FOCUS_TRACKS.length}
        </span>
      }
    >
      <div style={{
        display: 'grid', gap: 10,
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${FOCUS_TRACKS.length}, 1fr)`,
      }}>
        {FOCUS_TRACKS.map(t => {
          const row = byTrack[t.key]?.get(today)
          const done = Boolean(row)
          const n = streak(t.key)
          return (
            <div key={t.key} onClick={() => openTrack(t)} style={{
              border: `1px solid ${done ? t.color + '66' : COLORS.border}`,
              background: done ? t.color + '0D' : '#fff',
              borderRadius: 12, padding: 14, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 8,
              minHeight: isMobile ? 96 : 148,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{t.label}</span>
                <Badge color={done ? t.color : COLORS.gray}>{done ? '已记录' : '待记录'}</Badge>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                {done ? (
                  <>
                    {row.content && (
                      <div style={{
                        fontSize: 13, lineHeight: 1.6, color: COLORS.text,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>{row.content}</div>
                    )}
                    {row.win && (
                      <div style={{ fontSize: 12, color: t.color, marginTop: 6, fontWeight: 500 }}>
                        ✨ {row.win}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: COLORS.textLight, lineHeight: 1.6 }}>{t.hint}</div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  {days.map(d => (
                    <span key={d} title={d} style={{
                      width: 8, height: 8, borderRadius: 999, display: 'inline-block',
                      background: byTrack[t.key]?.has(d) ? t.color : COLORS.border,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: n > 0 ? COLORS.orange : COLORS.textLight }}>
                  {n > 0 ? `🔥 连续 ${n} 天` : '今天开始'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {recentWins.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>✨ 近 7 天成就</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentWins.map(r => {
              const t = FOCUS_TRACKS.find(x => x.key === r.track)
              return (
                <div key={r.id} style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'baseline' }}>
                  <span style={{ color: COLORS.textLight, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {r.log_date.slice(5).replace('-', '/')}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{t?.icon}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.win}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && editTrack && (
        <Modal title={`${editTrack.icon} ${editTrack.label}`} onClose={() => setEditing(null)}>
          <div style={{
            background: editTrack.color + '0D', border: `1px solid ${editTrack.color}33`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 6 }}>{today} · 今天问自己</div>
            {editTrack.prompts.map(p => (
              <div key={p} style={{ fontSize: 13, lineHeight: 1.8 }}>· {p}</div>
            ))}
          </div>

          <FormField label="今日思考">
            <TextArea value={editing.content} onChange={v => setEditing(d => ({ ...d, content: v }))}
              rows={5} placeholder="想到什么写什么，一两句也算数" />
          </FormField>
          <FormField label="今日成就" hint="这个方向上今天往前挪了哪怕一小步——写下来">
            <TextInput value={editing.win} onChange={v => setEditing(d => ({ ...d, win: v }))}
              placeholder="如：把不属于我的排期推回去了" />
          </FormField>

          <ModalActions onCancel={() => setEditing(null)} onSubmit={save}
            disabled={!editing.content.trim() && !editing.win.trim()}
            submitText={editing.id ? '更新' : '打卡'} />
        </Modal>
      )}
    </Card>
  )
}
