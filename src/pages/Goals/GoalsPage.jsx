import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, GOAL_LEVELS, GOAL_STATUS, MILESTONE_STATUS } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDate, todayStr, daysBetween } from '../../lib/date'

const emptyGoal = { title: '', description: '', level: 'month', status: 'active', start_date: todayStr(), due_date: '', parent_id: '' }

export function GoalsPage() {
  const { rows: goals, add, patch, del } = useTable('goals')
  const { rows: milestones, add: addMs, patch: patchMs, del: delMs } = useTable('goal_milestones', { orderBy: 'due_date', ascending: true })
  const { rows: logs, add: addLog, del: delLog } = useTable('goal_logs', { orderBy: 'log_date', ascending: false })

  const [filter, setFilter] = useState('all')
  const [goalModal, setGoalModal] = useState(null)
  const [detailId, setDetailId] = useState(null)

  const filtered = goals.filter(g => filter === 'all' ? g.status !== 'dropped' : g.level === filter)
  const detail = goals.find(g => g.id === detailId)

  const msOf = id => milestones.filter(m => m.goal_id === id)
  const progress = id => {
    const ms = msOf(id)
    if (ms.length === 0) return null
    return Math.round((ms.filter(m => m.status === 'passed' || m.status === 'partial').length / ms.length) * 100)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>全部</FilterBtn>
        {GOAL_LEVELS.map(l => (
          <FilterBtn key={l.key} active={filter === l.key} onClick={() => setFilter(l.key)}>{l.label}</FilterBtn>
        ))}
        <div style={{ flex: 1 }} />
        <AddButton onClick={() => setGoalModal({ ...emptyGoal })}>+ 新目标</AddButton>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon="🎯" text="设定一个目标，配上检查点，一步步兑现它" /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map(g => {
            const lv = GOAL_LEVELS.find(l => l.key === g.level)
            const st = GOAL_STATUS.find(s => s.key === g.status)
            const pg = progress(g.id)
            const overdue = g.due_date && g.status === 'active' && g.due_date < todayStr()
            return (
              <div key={g.id} onClick={() => setDetailId(g.id)} style={{
                background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`,
                padding: 16, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <Badge color={lv?.color}>{lv?.label}</Badge>
                  <Badge color={st?.color}>{st?.label}</Badge>
                  {overdue && <Badge color={COLORS.red}>已逾期</Badge>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{g.title}</div>
                {g.due_date && (
                  <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>
                    截止 {fmtDate(g.due_date)}
                    {g.status === 'active' && !overdue && `（剩 ${daysBetween(todayStr(), g.due_date)} 天）`}
                  </div>
                )}
                {pg != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: COLORS.border, borderRadius: 3 }}>
                      <div style={{ width: `${pg}%`, height: 6, background: COLORS.green, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: COLORS.textLight }}>{pg}%</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {goalModal && (
        <GoalModal draft={goalModal} setDraft={setGoalModal} goals={goals}
          onClose={() => setGoalModal(null)}
          onSubmit={async () => {
            const { id, created_at: _ca, ...data } = goalModal
            data.parent_id = data.parent_id || null
            data.due_date = data.due_date || null
            data.start_date = data.start_date || null
            if (id) await patch(id, data)
            else await add(data)
            setGoalModal(null)
          }} />
      )}

      {detail && (
        <GoalDetail
          goal={detail}
          milestones={msOf(detail.id)}
          logs={logs.filter(l => l.goal_id === detail.id)}
          onClose={() => setDetailId(null)}
          onEdit={() => { setGoalModal({ ...detail, parent_id: detail.parent_id || '' }); setDetailId(null) }}
          onDelete={async () => { await del(detail.id); setDetailId(null) }}
          onStatus={s => patch(detail.id, { status: s, ...(s === 'done' ? {} : {}) })}
          onReview={note => patch(detail.id, { review_note: note })}
          addMs={addMs} patchMs={patchMs} delMs={delMs}
          addLog={addLog} delLog={delLog}
        />
      )}
    </div>
  )
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 999, fontSize: 13,
      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
      background: active ? '#EFF6FF' : '#fff',
      color: active ? COLORS.primary : COLORS.text,
    }}>{children}</button>
  )
}

function GoalModal({ draft, setDraft, goals, onClose, onSubmit }) {
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const parentOptions = goals
    .filter(g => g.id !== draft.id && ['year', 'quarter'].includes(g.level))
    .map(g => ({ key: g.id, label: `[${GOAL_LEVELS.find(l => l.key === g.level)?.label}] ${g.title}` }))
  return (
    <Modal title={draft.id ? '编辑目标' : '新目标'} onClose={onClose}>
      <FormField label="目标" required>
        <TextInput value={draft.title} onChange={v => set('title', v)} placeholder="如：7 月减重 2kg / 2026 年学会吉他" />
      </FormField>
      <FormField label="说明">
        <TextArea value={draft.description} onChange={v => set('description', v)} rows={3}
          placeholder="为什么要做？做成什么样算成？" />
      </FormField>
      <Row>
        <FormField label="层级" required>
          <Select value={draft.level} onChange={v => set('level', v)} options={GOAL_LEVELS} />
        </FormField>
        <FormField label="状态">
          <Select value={draft.status} onChange={v => set('status', v)} options={GOAL_STATUS} />
        </FormField>
      </Row>
      <Row>
        <FormField label="开始日期">
          <TextInput type="date" value={draft.start_date} onChange={v => set('start_date', v)} />
        </FormField>
        <FormField label="截止日期">
          <TextInput type="date" value={draft.due_date} onChange={v => set('due_date', v)} />
        </FormField>
      </Row>
      {parentOptions.length > 0 && (
        <FormField label="挂靠上级目标" hint="月度/短期目标可挂在年度/季度目标下">
          <Select value={draft.parent_id} onChange={v => set('parent_id', v)} options={parentOptions} placeholder="（不挂靠）" />
        </FormField>
      )}
      <ModalActions onCancel={onClose} onSubmit={onSubmit} disabled={!draft.title} />
    </Modal>
  )
}

const emptyMs = { title: '', due_date: '', check_criteria: '' }

function GoalDetail({ goal, milestones, logs, onClose, onEdit, onDelete, onStatus, onReview, addMs, patchMs, delMs, addLog, delLog }) {
  const [msModal, setMsModal] = useState(null)
  const [checkModal, setCheckModal] = useState(null) // 检查点自检
  const [logText, setLogText] = useState('')
  const [reviewText, setReviewText] = useState(goal.review_note || '')
  const lv = GOAL_LEVELS.find(l => l.key === goal.level)
  const st = GOAL_STATUS.find(s => s.key === goal.status)

  return (
    <Modal title={`🎯 ${goal.title}`} onClose={onClose} width={720}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge color={lv?.color}>{lv?.label}</Badge>
        <Badge color={st?.color}>{st?.label}</Badge>
        <span style={{ fontSize: 12, color: COLORS.textLight }}>
          {fmtDate(goal.start_date)} → {fmtDate(goal.due_date)}
        </span>
        <div style={{ flex: 1 }} />
        <IconBtn onClick={onEdit} color={COLORS.primary}>编辑</IconBtn>
        <IconBtn onClick={onDelete} color={COLORS.red}>删除</IconBtn>
      </div>
      {goal.description && (
        <div style={{ fontSize: 14, color: COLORS.textLight, whiteSpace: 'pre-wrap', marginBottom: 14 }}>{goal.description}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {GOAL_STATUS.map(s => (
          <button key={s.key} onClick={() => onStatus(s.key)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12,
            border: `1px solid ${goal.status === s.key ? s.color : COLORS.border}`,
            background: goal.status === s.key ? s.color : '#fff',
            color: goal.status === s.key ? '#fff' : COLORS.text,
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── 里程碑 / 检查点 ── */}
      <SectionTitle title="里程碑 / 检查点" action={<IconBtn onClick={() => setMsModal({ ...emptyMs })} color={COLORS.primary}>+ 添加</IconBtn>} />
      {milestones.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 14 }}>
          还没有检查点。给目标设几个节点（截止日 + 验收标准），到点自检。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {milestones.map(m => {
            const ms = MILESTONE_STATUS.find(s => s.key === m.status)
            const due = m.due_date && m.status === 'pending' && m.due_date <= todayStr()
            return (
              <div key={m.id} style={{
                border: `1px solid ${due ? COLORS.orange : COLORS.border}`, borderRadius: 10, padding: 12,
                background: due ? '#FFFBEB' : '#FAFAFA',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge color={ms?.color}>{ms?.label}</Badge>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</span>
                  <span style={{ fontSize: 12, color: COLORS.textLight }}>{fmtDate(m.due_date)}</span>
                  {due && <span style={{ fontSize: 12, color: COLORS.orange, fontWeight: 600 }}>⏰ 到检查点了</span>}
                  <div style={{ flex: 1 }} />
                  <IconBtn onClick={() => setCheckModal({ ...m })} color={COLORS.primary}>
                    {m.status === 'pending' ? '自检' : '改结果'}
                  </IconBtn>
                  <IconBtn onClick={() => delMs(m.id)} color={COLORS.red}>删</IconBtn>
                </div>
                {m.check_criteria && (
                  <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 6 }}>验收标准：{m.check_criteria}</div>
                )}
                {m.check_result && (
                  <div style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>📝 {m.check_result}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 过程记录 ── */}
      <SectionTitle title="过程记录（每日推进）" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={logText} onChange={e => setLogText(e.target.value)}
          placeholder="今天为这个目标做了什么？"
          onKeyDown={async e => {
            if (e.key === 'Enter' && logText.trim()) {
              await addLog({ goal_id: goal.id, log_date: todayStr(), content: logText.trim() })
              setLogText('')
            }
          }}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${COLORS.border}`, fontSize: 14, outline: 'none',
          }} />
        <button onClick={async () => {
          if (!logText.trim()) return
          await addLog({ goal_id: goal.id, log_date: todayStr(), content: logText.trim() })
          setLogText('')
        }} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: COLORS.primary, color: '#fff', fontSize: 13,
        }}>记录</button>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
        {logs.map(l => (
          <div key={l.id} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ color: COLORS.textLight, whiteSpace: 'nowrap' }}>{l.log_date}</span>
            <span style={{ flex: 1 }}>{l.content}</span>
            <IconBtn onClick={() => delLog(l.id)} color={COLORS.red}>×</IconBtn>
          </div>
        ))}
        {logs.length === 0 && <div style={{ fontSize: 13, color: COLORS.textLight }}>暂无记录</div>}
      </div>

      {/* ── 结项复盘 ── */}
      {(goal.status === 'done' || goal.status === 'dropped' || goal.review_note) && (
        <>
          <SectionTitle title="结项复盘" />
          <TextArea value={reviewText} onChange={setReviewText} rows={3}
            placeholder="达成情况如何？学到了什么？下次怎么做更好？" />
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button onClick={() => onReview(reviewText)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: COLORS.green, color: '#fff', fontSize: 13,
            }}>保存复盘</button>
          </div>
        </>
      )}

      {msModal && (
        <Modal title="添加检查点" onClose={() => setMsModal(null)}>
          <FormField label="检查点名称" required>
            <TextInput value={msModal.title} onChange={v => setMsModal(d => ({ ...d, title: v }))}
              placeholder="如：第 2 周体重降到 74kg" />
          </FormField>
          <Row>
            <FormField label="截止日期">
              <TextInput type="date" value={msModal.due_date} onChange={v => setMsModal(d => ({ ...d, due_date: v }))} />
            </FormField>
            <div />
          </Row>
          <FormField label="验收标准" hint="到点用什么数据/结果来检验？">
            <TextArea value={msModal.check_criteria} onChange={v => setMsModal(d => ({ ...d, check_criteria: v }))} rows={2} />
          </FormField>
          <ModalActions onCancel={() => setMsModal(null)} disabled={!msModal.title}
            onSubmit={async () => {
              await addMs({ goal_id: goal.id, title: msModal.title, due_date: msModal.due_date || null, check_criteria: msModal.check_criteria || null, status: 'pending' })
              setMsModal(null)
            }} />
        </Modal>
      )}

      {checkModal && (
        <Modal title={`检查点自检：${checkModal.title}`} onClose={() => setCheckModal(null)}>
          {checkModal.check_criteria && (
            <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 12 }}>验收标准：{checkModal.check_criteria}</div>
          )}
          <FormField label="检验结论" required>
            <div style={{ display: 'flex', gap: 8 }}>
              {MILESTONE_STATUS.filter(s => s.key !== 'pending').map(s => (
                <button key={s.key} onClick={() => setCheckModal(d => ({ ...d, status: s.key }))} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13,
                  border: `1px solid ${checkModal.status === s.key ? s.color : COLORS.border}`,
                  background: checkModal.status === s.key ? s.color : '#fff',
                  color: checkModal.status === s.key ? '#fff' : COLORS.text,
                }}>{s.label}</button>
              ))}
            </div>
          </FormField>
          <FormField label="结果录入 / 自我检查" hint="录入实际数据与结论，对照验收标准">
            <TextArea value={checkModal.check_result || ''} onChange={v => setCheckModal(d => ({ ...d, check_result: v }))} rows={4} />
          </FormField>
          <ModalActions onCancel={() => setCheckModal(null)}
            disabled={checkModal.status === 'pending'}
            onSubmit={async () => {
              await patchMs(checkModal.id, {
                status: checkModal.status,
                check_result: checkModal.check_result || null,
                checked_at: new Date().toISOString(),
              })
              setCheckModal(null)
            }} />
        </Modal>
      )}
    </Modal>
  )
}

function SectionTitle({ title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 10px' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {action}
    </div>
  )
}
