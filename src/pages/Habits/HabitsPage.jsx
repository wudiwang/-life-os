import { useState, useMemo } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS } from '../../lib/constants'
import { Card, ScrollX } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, Select, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { todayStr, lastNDays, addDays } from '../../lib/date'

const emptyHabit = { name: '', icon: '💪', target_per_week: 7, remind_time: '' }
const ICONS = ['💪', '📖', '🏃', '🧘', '💧', '😴', '✍️', '🎸', '🥗', '🚭', '✅']

export function HabitsPage() {
  const { rows: habits, add, patch, del } = useTable('habits', { orderBy: 'created_at', ascending: true })
  const { rows: logs, add: addLog, del: delLog } = useTable('habit_logs', { orderBy: 'log_date', ascending: false })
  const [modal, setModal] = useState(null)

  const days = useMemo(() => lastNDays(7), [])
  const activeHabits = habits.filter(h => h.active !== false)

  // habit_id -> Set(log_date)
  const doneMap = useMemo(() => {
    const m = {}
    logs.forEach(l => {
      if (!l.done) return
      if (!m[l.habit_id]) m[l.habit_id] = new Map()
      m[l.habit_id].set(l.log_date, l.id)
    })
    return m
  }, [logs])

  const streak = habitId => {
    const map = doneMap[habitId]
    if (!map) return 0
    let n = 0
    let d = todayStr()
    if (!map.has(d)) d = addDays(d, -1) // 今天还没打卡不算断
    while (map.has(d)) { n++; d = addDays(d, -1) }
    return n
  }

  const weekCount = habitId => days.filter(d => doneMap[habitId]?.has(d)).length

  const toggle = async (habit, date) => {
    const logId = doneMap[habit.id]?.get(date)
    if (logId) await delLog(logId)
    else await addLog({ habit_id: habit.id, log_date: date, done: true })
  }

  const todayDone = activeHabits.filter(h => doneMap[h.id]?.has(todayStr())).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 14, color: COLORS.textLight }}>
          今日进度：<b style={{ color: COLORS.primary, fontSize: 18 }}>{todayDone}</b> / {activeHabits.length}
        </div>
        <div style={{ flex: 1 }} />
        <AddButton onClick={() => setModal({ ...emptyHabit })}>+ 新习惯</AddButton>
      </div>

      {activeHabits.length === 0 ? (
        <Card><EmptyState icon="🌱" text='还没有习惯。从一个小习惯开始，比如"每天锻炼 20 分钟"' /></Card>
      ) : (
        <Card>
          <ScrollX>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ color: COLORS.textLight, fontSize: 12 }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>习惯</th>
                {days.map(d => (
                  <th key={d} style={{ padding: '6px 4px', fontWeight: d === todayStr() ? 700 : 400, color: d === todayStr() ? COLORS.primary : undefined }}>
                    {d.slice(5).replace('-', '/')}
                  </th>
                ))}
                <th style={{ padding: '6px 8px' }}>连续</th>
                <th style={{ padding: '6px 8px' }}>本周</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {activeHabits.map(h => (
                <tr key={h.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    <span style={{ marginRight: 6 }}>{h.icon}</span>{h.name}
                    {h.remind_time && <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: 6 }}>⏰{h.remind_time}</span>}
                  </td>
                  {days.map(d => {
                    const done = doneMap[h.id]?.has(d)
                    return (
                      <td key={d} style={{ textAlign: 'center', padding: '4px 2px' }}>
                        <button onClick={() => toggle(h, d)} style={{
                          width: 30, height: 30, borderRadius: 8, fontSize: 15,
                          border: `1.5px solid ${done ? COLORS.green : COLORS.border}`,
                          background: done ? COLORS.green : '#fff', color: '#fff',
                        }}>{done ? '✓' : ''}</button>
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                    <Badge color={streak(h.id) >= 7 ? COLORS.orange : COLORS.gray}>🔥 {streak(h.id)} 天</Badge>
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: 13 }}>
                    <span style={{ color: weekCount(h.id) >= (h.target_per_week || 7) ? COLORS.green : COLORS.textLight }}>
                      {weekCount(h.id)}/{h.target_per_week || 7}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <IconBtn onClick={() => setModal({ ...h })} title="编辑">编辑</IconBtn>
                    <IconBtn onClick={() => patch(h.id, { active: false })} title="归档" color={COLORS.orange}>归档</IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollX>
        </Card>
      )}

      {habits.some(h => h.active === false) && (
        <Card title="已归档">
          {habits.filter(h => h.active === false).map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14, color: COLORS.textLight }}>
              <span>{h.icon} {h.name}</span>
              <IconBtn onClick={() => patch(h.id, { active: true })} color={COLORS.primary}>恢复</IconBtn>
              <IconBtn onClick={() => del(h.id)} color={COLORS.red}>删除</IconBtn>
            </div>
          ))}
        </Card>
      )}

      {modal && (
        <Modal title={modal.id ? '编辑习惯' : '新习惯'} onClose={() => setModal(null)}>
          <FormField label="习惯名称" required>
            <TextInput value={modal.name} onChange={v => setModal(d => ({ ...d, name: v }))} placeholder="如：健身 30 分钟" />
          </FormField>
          <FormField label="图标">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setModal(d => ({ ...d, icon: ic }))} style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: 18,
                  border: `2px solid ${modal.icon === ic ? COLORS.primary : COLORS.border}`,
                  background: '#fff',
                }}>{ic}</button>
              ))}
            </div>
          </FormField>
          <Row>
            <FormField label="每周目标次数">
              <Select value={String(modal.target_per_week)} onChange={v => setModal(d => ({ ...d, target_per_week: Number(v) }))}
                options={[1, 2, 3, 4, 5, 6, 7].map(n => ({ key: String(n), label: `${n} 次/周` }))} />
            </FormField>
            <FormField label="提醒时间（展示用）">
              <TextInput type="time" value={modal.remind_time} onChange={v => setModal(d => ({ ...d, remind_time: v }))} />
            </FormField>
          </Row>
          <ModalActions onCancel={() => setModal(null)} disabled={!modal.name}
            onSubmit={async () => {
              const { id, created_at: _ca, ...data } = modal
              if (id) await patch(id, data)
              else await add({ ...data, active: true })
              setModal(null)
            }} />
        </Modal>
      )}
    </div>
  )
}
