// 人生看板首页（2026-10-13 重构）。
// 用户反馈：原首页文字太多、注意力涣散。改为「一眼看懂」：
//   核心原则一行 → 三大主线卡片(主体) → 关键指标一条 → 其余重文字模块收进折叠区。
// 折叠而非删除：本周契约/每日三向/人生阶段面板只在首页有入口，删掉等于丢功能。
import { useState } from 'react'

import { Badge } from '../../components/common/Badge'
import { TextArea } from '../../components/common/FormField'
import { Modal, ModalActions } from '../../components/common/Modal'
import { Card } from '../../components/common/StatCard'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTable } from '../../hooks/useTable'
import { COLORS, GOAL_LEVELS, METRIC_TYPES, MOODS } from '../../lib/constants'
import { daysBetween, todayStr } from '../../lib/date'
import { useUIStore } from '../../store/useUIStore'
import { DailyFocusCard } from './DailyFocusCard'
import { MainLines } from './MainLines'
import { WeeklyActionsCard } from './WeeklyActionsCard'

const STAGE_FIELDS = [
  { key: 'stage', label: '阶段定位', icon: '📍', hint: '我现在处于人生哪个阶段？（年龄、身份、核心矛盾）' },
  { key: 'focus', label: '阶段重点', icon: '🎯', hint: '这个阶段必须做好的 3-5 件事' },
  { key: 'advice', label: '方向建议', icon: '🧭', hint: '大方向上的提醒（可让 AI 分析后填入）' },
]
const PRINCIPLE_FIELD = { key: 'principle', label: '核心原则', icon: '⚡', hint: '一进系统就要看到的人生准则' }
const ALL_STAGE_FIELDS = [PRINCIPLE_FIELD, ...STAGE_FIELDS]

/** 一条极简指标：图标 + 数字 + 标签，点击跳转。不写解释文字。 */
function Pill({ icon, value, label, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: '1 1 0', minWidth: 0, cursor: 'pointer', textAlign: 'left',
      background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10,
      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9,
    }}>
      <span style={{ fontSize: 17, lineHeight: 1, flex: 'none' }} aria-hidden>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 15, fontWeight: 700, color,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value}</span>
        <span style={{ display: 'block', fontSize: 11, color: COLORS.textLight }}>{label}</span>
      </span>
    </button>
  )
}

export function DashboardPage() {
  const isMobile = useIsMobile()
  const setPage = useUIStore(s => s.setPage)
  const { rows: habits } = useTable('habits')
  const { rows: habitLogs } = useTable('habit_logs', { orderBy: 'log_date', ascending: false, limit: 500 })
  const { rows: goals } = useTable('goals')
  const { rows: milestones } = useTable('goal_milestones', { orderBy: 'due_date', ascending: true })
  const { rows: metrics } = useTable('health_metrics', { orderBy: 'measured_at', ascending: false, limit: 50 })
  const { rows: journal } = useTable('journal_entries', { orderBy: 'entry_date', ascending: false, limit: 10 })
  const { rows: stageRows, add: addStage, patch: patchStage } = useTable('life_stage')
  const [editing, setEditing] = useState(null)
  const [more, setMore] = useState(false)

  const today = todayStr()
  const activeHabits = habits.filter(h => h.active !== false)
  const todayHabits = activeHabits.filter(h => habitLogs.some(l => l.habit_id === h.id && l.log_date === today && l.done))
  const todayJournal = journal.find(j => j.entry_date === today)
  const weight = metrics.find(m => m.metric_type === 'weight')
  const activeGoals = goals.filter(g => g.status === 'active')

  const dueMilestones = milestones
    .filter(m => m.status === 'pending' && m.due_date && daysBetween(today, m.due_date) <= 7)
    .slice(0, 3)

  const stageOf = f => stageRows.find(r => r.field === f)
  const principle = stageOf('principle')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 核心原则：一行，不展开长文 */}
      <button
        onClick={() => setEditing({ field: 'principle', content: principle?.content || '', id: principle?.id })}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
          padding: isMobile ? '11px 13px' : '12px 16px',
        }}>
        <span style={{ fontSize: 17, lineHeight: 1, flex: 'none' }} aria-hidden>⚡</span>
        <span style={{
          flex: 1, minWidth: 0, fontSize: isMobile ? 13.5 : 14.5, fontWeight: 600,
          color: principle?.content ? '#92400E' : COLORS.textLight,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{principle?.content || '写下一条一进来就要看到的人生准则'}</span>
      </button>

      {/* 三大主线：首页主体 */}
      <MainLines />

      {/* 关键指标：一条，纯数字 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Pill icon="❤️" value={weight ? `${weight.value_num}kg` : '—'} label="体重"
          color={COLORS.red} onClick={() => setPage('health')} />
        <Pill icon="🔁" value={`${todayHabits.length}/${activeHabits.length}`} label="今日习惯"
          color={activeHabits.length > 0 && todayHabits.length === activeHabits.length ? COLORS.green : COLORS.primary}
          onClick={() => setPage('habits')} />
        <Pill icon="📔" value={todayJournal ? (MOODS.find(m => m.value === todayJournal.mood)?.icon || '✓') : '未写'}
          label="今日一记" color={todayJournal ? COLORS.green : COLORS.orange}
          onClick={() => setPage('journal')} />
        <Pill icon="🎯" value={activeGoals.length} label="进行中目标"
          color={COLORS.purple} onClick={() => setPage('goals')} />
      </div>

      {/* 检查点：只在临近时出现，最多 3 条 */}
      {dueMilestones.length > 0 && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '10px 14px', cursor: 'pointer',
        }} onClick={() => setPage('goals')}>
          {dueMilestones.map(m => {
            const g = goals.find(x => x.id === m.goal_id)
            const overdue = m.due_date < today
            return (
              <div key={m.id} style={{ fontSize: 12.5, padding: '3px 0' }}>
                <span style={{ color: overdue ? COLORS.red : COLORS.orange, fontWeight: 700 }}>
                  {overdue ? '已到期' : `${daysBetween(today, m.due_date)}天后`}
                </span>
                {' · '}{g?.title} → {m.title}
              </div>
            )
          })}
        </div>
      )}

      {/* 其余模块：默认折叠，保持首页清爽 */}
      <button onClick={() => setMore(v => !v)} style={{
        alignSelf: 'center', cursor: 'pointer', background: 'none',
        border: `1px solid ${COLORS.border}`, borderRadius: 99,
        padding: '7px 18px', fontSize: 12.5, color: COLORS.textLight,
      }}>{more ? '收起' : '更多 · 本周契约 / 每日三向 / 人生阶段'}</button>

      {more && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WeeklyActionsCard />
          <DailyFocusCard />
          <Card title="🌱 人生阶段面板">
            <div style={{
              display: 'grid', gap: 12,
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
            }}>
              {STAGE_FIELDS.map(f => {
                const row = stageOf(f.key)
                return (
                  <div key={f.key} onClick={() => setEditing({ field: f.key, content: row?.content || '', id: row?.id })}
                    style={{
                      border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14,
                      cursor: 'pointer', minHeight: 92,
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{f.icon} {f.label}</div>
                    {row?.content ? (
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{row.content}</div>
                    ) : (
                      <div style={{ fontSize: 12, color: COLORS.textLight }}>{f.hint}（点击填写）</div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
          {activeGoals.length > 0 && (
            <Card title="🎯 进行中的目标">
              {activeGoals.slice(0, 6).map(g => {
                const lv = GOAL_LEVELS.find(l => l.key === g.level)
                return (
                  <div key={g.id} onClick={() => setPage('goals')} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                    borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', fontSize: 14,
                  }}>
                    <Badge color={lv?.color}>{lv?.label}</Badge>
                    <span style={{ flex: 1 }}>{g.title}</span>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      )}

      {editing && (
        <Modal title={`${ALL_STAGE_FIELDS.find(f => f.key === editing.field)?.icon} ${ALL_STAGE_FIELDS.find(f => f.key === editing.field)?.label}`}
          onClose={() => setEditing(null)}>
          <TextArea value={editing.content} onChange={v => setEditing(d => ({ ...d, content: v }))} rows={6}
            placeholder={ALL_STAGE_FIELDS.find(f => f.key === editing.field)?.hint} />
          <ModalActions onCancel={() => setEditing(null)}
            onSubmit={async () => {
              if (editing.id) await patchStage(editing.id, { content: editing.content })
              else await addStage({ field: editing.field, content: editing.content })
              setEditing(null)
            }} />
        </Modal>
      )}
    </div>
  )
}
