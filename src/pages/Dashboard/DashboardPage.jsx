import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, METRIC_TYPES, GOAL_LEVELS, MOODS } from '../../lib/constants'
import { StatCard, Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { TextArea } from '../../components/common/FormField'
import { Badge } from '../../components/common/Badge'
import { todayStr, fmtDate, daysBetween } from '../../lib/date'
import { useUIStore } from '../../store/useUIStore'
import { DailyFocusCard } from './DailyFocusCard'

const STAGE_FIELDS = [
  { key: 'stage', label: '阶段定位', icon: '📍', hint: '我现在处于人生哪个阶段？（年龄、身份、核心矛盾）' },
  { key: 'focus', label: '阶段重点', icon: '🎯', hint: '这个阶段必须做好的 3-5 件事' },
  { key: 'advice', label: '方向建议', icon: '🧭', hint: '大方向上的提醒（可让 AI 分析后填入）' },
]

// 核心原则：首页最显眼位置，一进来就看到
const PRINCIPLE_FIELD = { key: 'principle', label: '核心原则', icon: '⚡', hint: '一进系统就要看到的人生准则' }
const ALL_STAGE_FIELDS = [PRINCIPLE_FIELD, ...STAGE_FIELDS]

export function DashboardPage() {
  const setPage = useUIStore(s => s.setPage)
  const { rows: todos } = useTable('work_todos')
  const { rows: habits } = useTable('habits')
  const { rows: habitLogs } = useTable('habit_logs', { orderBy: 'log_date', ascending: false, limit: 500 })
  const { rows: goals } = useTable('goals')
  const { rows: milestones } = useTable('goal_milestones', { orderBy: 'due_date', ascending: true })
  const { rows: metrics } = useTable('health_metrics', { orderBy: 'measured_at', ascending: false, limit: 50 })
  const { rows: journal } = useTable('journal_entries', { orderBy: 'entry_date', ascending: false, limit: 10 })
  const { rows: stageRows, add: addStage, patch: patchStage } = useTable('life_stage')
  const [editing, setEditing] = useState(null)

  const today = todayStr()
  const openTodos = todos.filter(t => t.status !== 'done')
  const activeHabits = habits.filter(h => h.active !== false)
  const todayHabits = activeHabits.filter(h => habitLogs.some(l => l.habit_id === h.id && l.log_date === today && l.done))
  const activeGoals = goals.filter(g => g.status === 'active')
  const todayJournal = journal.find(j => j.entry_date === today)

  const latestOf = type => metrics.find(m => m.metric_type === type)
  const weight = latestOf('weight')
  const bp = latestOf('blood_pressure')

  // 即将到期/已到期的检查点（未检查）
  const dueMilestones = milestones
    .filter(m => m.status === 'pending' && m.due_date && daysBetween(today, m.due_date) <= 7)
    .slice(0, 5)

  const stageOf = f => stageRows.find(r => r.field === f)

  const principle = stageOf('principle')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 核心原则横幅 */}
      <div
        onClick={() => setEditing({ field: 'principle', content: principle?.content || '', id: principle?.id })}
        style={{
          background: 'linear-gradient(135deg, #1E3A8A, #3B82F6)', color: '#fff',
          borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>⚡ 核心原则</div>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {principle?.content || '点击写下你的核心原则，让它每天第一眼提醒你'}
        </div>
      </div>

      {/* 每日三向：固定思考方向打卡，紧跟核心原则占住第一屏 */}
      <DailyFocusCard />

      {/* 今日概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <StatCard icon="📔" label="今日一记" value={todayJournal ? (MOODS.find(m => m.value === todayJournal.mood)?.icon || '✓') : '未写'}
          sub={todayJournal ? '已记录' : '花一分钟记下今天'} color={todayJournal ? COLORS.green : COLORS.orange}
          onClick={() => setPage('journal')} />
        <StatCard icon="🔁" label="习惯打卡" value={`${todayHabits.length}/${activeHabits.length}`}
          sub={activeHabits.length === 0 ? '还没有习惯' : (todayHabits.length === activeHabits.length ? '今日全部完成 🎉' : '继续加油')}
          color={activeHabits.length > 0 && todayHabits.length === activeHabits.length ? COLORS.green : COLORS.primary}
          onClick={() => setPage('habits')} />
        <StatCard icon="✅" label="待办" value={openTodos.length}
          sub={openTodos.length === 0 ? '全部清空' : `${openTodos.filter(t => t.priority === 'high').length} 项高优先级`}
          color={openTodos.length === 0 ? COLORS.green : COLORS.orange}
          onClick={() => setPage('work')} />
        <StatCard icon="🎯" label="进行中目标" value={activeGoals.length}
          sub={dueMilestones.length > 0 ? `${dueMilestones.length} 个检查点临近` : '按计划推进'}
          color={COLORS.purple} onClick={() => setPage('goals')} />
        <StatCard icon="❤️" label="最近体重" value={weight ? `${weight.value_num}kg` : '—'}
          sub={bp ? `血压 ${bp.value_num}/${bp.value2_num}` : '记录健康指标'}
          color={COLORS.red} onClick={() => setPage('health')} />
      </div>

      {/* 检查点提醒 */}
      {dueMilestones.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>⏰ 目标检查点提醒</div>
          {dueMilestones.map(m => {
            const g = goals.find(x => x.id === m.goal_id)
            const overdue = m.due_date < today
            return (
              <div key={m.id} style={{ fontSize: 13, padding: '3px 0', cursor: 'pointer' }} onClick={() => setPage('goals')}>
                <span style={{ color: overdue ? COLORS.red : COLORS.orange, fontWeight: 600 }}>
                  {overdue ? '已到期' : `${daysBetween(today, m.due_date)} 天后`}
                </span>
                {' · '}{g?.title} → {m.title}
              </div>
            )
          })}
        </div>
      )}

      {/* 人生阶段面板 */}
      <Card title="🌱 人生阶段面板" extra={
        <span style={{ fontSize: 12, color: COLORS.textLight }}>看清自己所处的位置，才知道往哪走</span>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {STAGE_FIELDS.map(f => {
            const row = stageOf(f.key)
            return (
              <div key={f.key} onClick={() => setEditing({ field: f.key, content: row?.content || '', id: row?.id })} style={{
                border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, cursor: 'pointer', minHeight: 100,
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

      {/* 进行中目标 */}
      {activeGoals.length > 0 && (
        <Card title="🎯 进行中的目标" extra={<IconLink onClick={() => setPage('goals')} />}>
          {activeGoals.slice(0, 6).map(g => {
            const lv = GOAL_LEVELS.find(l => l.key === g.level)
            const gms = milestones.filter(m => m.goal_id === g.id)
            const passed = gms.filter(m => m.status === 'passed' || m.status === 'partial').length
            return (
              <div key={g.id} onClick={() => setPage('goals')} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', fontSize: 14,
              }}>
                <Badge color={lv?.color}>{lv?.label}</Badge>
                <span style={{ flex: 1 }}>{g.title}</span>
                {gms.length > 0 && <span style={{ fontSize: 12, color: COLORS.textLight }}>检查点 {passed}/{gms.length}</span>}
                {g.due_date && <span style={{ fontSize: 12, color: COLORS.textLight }}>{fmtDate(g.due_date)}</span>}
              </div>
            )
          })}
        </Card>
      )}

      {/* 最近记录 */}
      {journal.length > 0 && (
        <Card title="📔 最近的记录" extra={<IconLink onClick={() => setPage('journal')} />}>
          {journal.slice(0, 5).map(j => (
            <div key={j.id} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${COLORS.border}` }}>
              <span>{MOODS.find(m => m.value === j.mood)?.icon || '🙂'}</span>
              <span style={{ color: COLORS.textLight, whiteSpace: 'nowrap' }}>{j.entry_date}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.content}</span>
            </div>
          ))}
        </Card>
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

function IconLink({ onClick }) {
  return (
    <button onClick={onClick} style={{
      border: 'none', background: 'none', color: COLORS.primary, fontSize: 13,
    }}>查看全部 →</button>
  )
}
