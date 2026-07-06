import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, TODO_PRIORITIES } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDate, todayStr } from '../../lib/date'

export function WorkPage() {
  const [tab, setTab] = useState('todos')
  const tabs = [
    { key: 'todos', label: '✅ 每日待办' },
    { key: 'logs', label: '📝 工作日志' },
    { key: 'profile', label: '📌 职责档案' },
    { key: 'contacts', label: '👥 人际地图' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 14,
            border: `1px solid ${tab === t.key ? COLORS.primary : COLORS.border}`,
            background: tab === t.key ? COLORS.primary : '#fff',
            color: tab === t.key ? '#fff' : COLORS.text, fontWeight: tab === t.key ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>
      {tab === 'todos' && <TodosTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'contacts' && <ContactsTab />}
    </div>
  )
}

// ── 每日待办 ──
function TodosTab() {
  const { rows, add, patch, del } = useTable('work_todos')
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('mid')

  const open = rows.filter(r => r.status !== 'done')
    .sort((a, b) => {
      const pOrder = { high: 0, mid: 1, low: 2 }
      return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1)
    })
  const doneToday = rows.filter(r => r.status === 'done' && (r.done_at || '').slice(0, 10) === todayStr())

  const submit = async () => {
    if (!text.trim()) return
    await add({ title: text.trim(), priority, status: 'open', due_date: todayStr() })
    setText('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="添加待办，回车提交"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, outline: 'none' }} />
          <select value={priority} onChange={e => setPriority(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>
            {TODO_PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}优先级</option>)}
          </select>
          <AddButton onClick={submit}>添加</AddButton>
        </div>
      </Card>

      <Card title={`待处理（${open.length}）`}>
        {open.length === 0 ? <EmptyState icon="🎉" text="全部清空，干得漂亮" /> : open.map(t => {
          const p = TODO_PRIORITIES.find(x => x.key === t.priority)
          const overdue = t.due_date && t.due_date < todayStr()
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
              <button onClick={() => patch(t.id, { status: 'done', done_at: new Date().toISOString() })} style={{
                width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${COLORS.border}`, background: '#fff',
              }} title="完成" />
              <Badge color={p?.color}>{p?.label}</Badge>
              <span style={{ flex: 1, fontSize: 14 }}>{t.title}</span>
              {t.due_date && <span style={{ fontSize: 12, color: overdue ? COLORS.red : COLORS.textLight }}>{fmtDate(t.due_date)}</span>}
              <IconBtn onClick={() => del(t.id)} color={COLORS.red}>删</IconBtn>
            </div>
          )
        })}
      </Card>

      {doneToday.length > 0 && (
        <Card title={`今日已完成（${doneToday.length}）`}>
          {doneToday.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 14, color: COLORS.textLight }}>
              <span style={{ color: COLORS.green }}>✓</span>
              <span style={{ flex: 1, textDecoration: 'line-through' }}>{t.title}</span>
              <IconBtn onClick={() => patch(t.id, { status: 'open', done_at: null })}>撤销</IconBtn>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ── 工作日志 ──
const emptyLog = { log_date: todayStr(), content: '', output: '', issues: '' }

function LogsTab() {
  const { rows, add, patch, del } = useTable('work_logs', { orderBy: 'log_date', ascending: false })
  const [modal, setModal] = useState(null)
  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={() => setModal({ ...emptyLog })}>+ 写日志</AddButton>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon="📝" text="每天记一笔：做了什么、产出、问题。汇报和复盘都有据可查" /></Card>
      ) : rows.map(r => (
        <Card key={r.id} title={`📅 ${r.log_date}`}
          extra={
            <div>
              <IconBtn onClick={() => setModal({ ...r })} color={COLORS.primary}>编辑</IconBtn>
              <IconBtn onClick={() => del(r.id)} color={COLORS.red}>删</IconBtn>
            </div>
          }>
          {r.content && <LogSection label="做了什么" text={r.content} />}
          {r.output && <LogSection label="产出" text={r.output} color={COLORS.green} />}
          {r.issues && <LogSection label="问题 / 风险" text={r.issues} color={COLORS.orange} />}
        </Card>
      ))}

      {modal && (
        <Modal title={modal.id ? '编辑日志' : '今日工作日志'} onClose={() => setModal(null)}>
          <FormField label="日期">
            <TextInput type="date" value={modal.log_date} onChange={v => set('log_date', v)} />
          </FormField>
          <FormField label="做了什么">
            <TextArea value={modal.content} onChange={v => set('content', v)} rows={4} placeholder="今天推进了哪些事？" />
          </FormField>
          <FormField label="产出">
            <TextArea value={modal.output} onChange={v => set('output', v)} rows={2} placeholder="可见的成果：文档/上线/决议…" />
          </FormField>
          <FormField label="问题 / 风险">
            <TextArea value={modal.issues} onChange={v => set('issues', v)} rows={2} placeholder="遇到什么阻塞？需要谁支持？" />
          </FormField>
          <ModalActions onCancel={() => setModal(null)} disabled={!modal.content && !modal.output}
            onSubmit={async () => {
              const { id, created_at: _ca, ...data } = modal
              if (id) await patch(id, data)
              else await add(data)
              setModal(null)
            }} />
        </Modal>
      )}
    </div>
  )
}

function LogSection({ label, text, color = COLORS.primary }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  )
}

// ── 职责档案 ──
const PROFILE_FIELDS = [
  { key: 'duty', label: '职责范围', icon: '🧭', hint: '我的岗位职责边界：管什么、不管什么' },
  { key: 'output', label: '产出要求', icon: '📦', hint: '老板/组织期待我交付什么？衡量标准是什么？' },
  { key: 'care', label: '注意事项', icon: '⚠️', hint: '踩过的坑、红线、汇报口径、姿态调整要点' },
]

function ProfileTab() {
  const { rows, add, patch } = useTable('work_profile')
  const [editing, setEditing] = useState(null) // {field, content, id?}

  const rowOf = f => rows.find(r => r.field === f)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {PROFILE_FIELDS.map(f => {
        const row = rowOf(f.key)
        return (
          <Card key={f.key} title={`${f.icon} ${f.label}`}
            extra={<IconBtn onClick={() => setEditing({ field: f.key, content: row?.content || '', id: row?.id })} color={COLORS.primary}>编辑</IconBtn>}>
            {row?.content ? (
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{row.content}</div>
            ) : (
              <div style={{ fontSize: 13, color: COLORS.textLight }}>{f.hint}</div>
            )}
          </Card>
        )
      })}

      {editing && (
        <Modal title={`编辑：${PROFILE_FIELDS.find(f => f.key === editing.field)?.label}`} onClose={() => setEditing(null)}>
          <TextArea value={editing.content} onChange={v => setEditing(d => ({ ...d, content: v }))} rows={8}
            placeholder={PROFILE_FIELDS.find(f => f.key === editing.field)?.hint} />
          <ModalActions onCancel={() => setEditing(null)}
            onSubmit={async () => {
              if (editing.id) await patch(editing.id, { content: editing.content })
              else await add({ field: editing.field, content: editing.content })
              setEditing(null)
            }} />
        </Modal>
      )}
    </div>
  )
}

// ── 人际地图 ──
const REL_OPTIONS = ['汇报人', '上级', '下级', '同级同事', '跨部门', '外部伙伴']
const emptyContact = { name: '', dept: '', role: '', relation: '同级同事', duties: '', stance: '', notes: '' }

function ContactsTab() {
  const { rows, add, patch, del } = useTable('work_contacts', { orderBy: 'created_at', ascending: true })
  const [modal, setModal] = useState(null)
  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  const groups = REL_OPTIONS.map(rel => ({ rel, people: rows.filter(r => r.relation === rel) }))
    .filter(g => g.people.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={() => setModal({ ...emptyContact })}>+ 添加同事</AddButton>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon="👥" text="记录关键同事：职责、性格、相处姿态。人际也是生产力" /></Card>
      ) : groups.map(g => (
        <Card key={g.rel} title={`${g.rel}（${g.people.length}）`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {g.people.map(p => (
              <div key={p.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: COLORS.textLight }}>{[p.dept, p.role].filter(Boolean).join(' · ')}</span>
                  <div style={{ flex: 1 }} />
                  <IconBtn onClick={() => setModal({ ...p })} color={COLORS.primary}>编辑</IconBtn>
                  <IconBtn onClick={() => del(p.id)} color={COLORS.red}>删</IconBtn>
                </div>
                {p.duties && <div style={{ fontSize: 13, marginBottom: 4 }}><b>职责：</b>{p.duties}</div>}
                {p.stance && <div style={{ fontSize: 13, marginBottom: 4, color: COLORS.primaryDark }}><b>相处姿态：</b>{p.stance}</div>}
                {p.notes && <div style={{ fontSize: 13, color: COLORS.textLight }}>{p.notes}</div>}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {modal && (
        <Modal title={modal.id ? '编辑' : '添加同事'} onClose={() => setModal(null)}>
          <Row>
            <FormField label="姓名" required>
              <TextInput value={modal.name} onChange={v => set('name', v)} />
            </FormField>
            <FormField label="关系" required>
              <Select value={modal.relation} onChange={v => set('relation', v)} options={REL_OPTIONS} />
            </FormField>
          </Row>
          <Row>
            <FormField label="部门">
              <TextInput value={modal.dept} onChange={v => set('dept', v)} />
            </FormField>
            <FormField label="职位">
              <TextInput value={modal.role} onChange={v => set('role', v)} />
            </FormField>
          </Row>
          <FormField label="其职责">
            <TextInput value={modal.duties} onChange={v => set('duties', v)} placeholder="他/她负责什么？" />
          </FormField>
          <FormField label="相处姿态 / 注意点">
            <TextArea value={modal.stance} onChange={v => set('stance', v)} rows={2}
              placeholder="如：直接汇报数据不讲过程；对 deadline 敏感，提前同步" />
          </FormField>
          <FormField label="备注">
            <TextArea value={modal.notes} onChange={v => set('notes', v)} rows={2} />
          </FormField>
          <ModalActions onCancel={() => setModal(null)} disabled={!modal.name}
            onSubmit={async () => {
              const { id, created_at: _ca, ...data } = modal
              if (id) await patch(id, data)
              else await add(data)
              setModal(null)
            }} />
        </Modal>
      )}
    </div>
  )
}
