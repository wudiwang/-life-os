import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, REL_TYPES } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDate, todayStr, daysBetween } from '../../lib/date'

const emptyPerson = { name: '', rel_type: 'family', birthday: '', closeness: 3, notes: '' }
const emptyLog = { log_date: todayStr(), event: '', feeling: '' }

// 距下个生日的天数；无生日返回 null
function daysToBirthday(birthday) {
  if (!birthday) return null
  const today = new Date(todayStr())
  const b = new Date(birthday)
  if (isNaN(b)) return null
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next - today) / 86400000)
}

export function RelationsPage() {
  const { rows: people, add, patch, del } = useTable('relation_people', { orderBy: 'created_at', ascending: true })
  const { rows: logs, add: addLog, del: delLog } = useTable('relation_logs', { orderBy: 'log_date', ascending: false })
  const [personModal, setPersonModal] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [logModal, setLogModal] = useState(null)
  const set = (k, v) => setPersonModal(d => ({ ...d, [k]: v }))

  const detail = people.find(p => p.id === detailId)
  const logsOf = id => logs.filter(l => l.person_id === id)
  const lastContact = id => logsOf(id)[0]?.log_date

  // 提醒：7 天内生日 / 60 天未互动
  const reminders = []
  people.forEach(p => {
    const d = daysToBirthday(p.birthday)
    if (d != null && d <= 7) reminders.push(`🎂 ${p.name} 的生日${d === 0 ? '就是今天！' : `还有 ${d} 天`}`)
    const lc = lastContact(p.id)
    if (lc && daysBetween(lc, todayStr()) > 60) reminders.push(`💬 和 ${p.name} 已 ${daysBetween(lc, todayStr())} 天没有记录互动了`)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {reminders.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
          {reminders.map((r, i) => <div key={i} style={{ padding: '2px 0' }}>{r}</div>)}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={() => setPersonModal({ ...emptyPerson })}>+ 添加重要的人</AddButton>
      </div>

      {REL_TYPES.map(t => {
        const group = people.filter(p => p.rel_type === t.key)
        if (group.length === 0) return null
        return (
          <Card key={t.key} title={`${t.icon} ${t.label}（${group.length}）`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {group.map(p => (
                <div key={p.id} onClick={() => setDetailId(p.id)} style={{
                  border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                    <Badge color={t.color}>{'❤'.repeat(p.closeness || 3)}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textLight }}>
                    {p.birthday && <span>🎂 {fmtDate(p.birthday)} · </span>}
                    最近互动：{lastContact(p.id) || '暂无记录'}
                  </div>
                  {p.notes && <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>{p.notes}</div>}
                </div>
              ))}
            </div>
          </Card>
        )
      })}

      {people.length === 0 && (
        <Card><EmptyState icon="💞" text="亲情、友情、爱情——把重要的人放在心上，也记在这里" /></Card>
      )}

      {personModal && (
        <Modal title={personModal.id ? '编辑' : '添加重要的人'} onClose={() => setPersonModal(null)}>
          <Row>
            <FormField label="称呼" required>
              <TextInput value={personModal.name} onChange={v => set('name', v)} />
            </FormField>
            <FormField label="关系" required>
              <Select value={personModal.rel_type} onChange={v => set('rel_type', v)}
                options={REL_TYPES.map(t => ({ key: t.key, label: `${t.icon} ${t.label}` }))} />
            </FormField>
          </Row>
          <Row>
            <FormField label="生日">
              <TextInput type="date" value={personModal.birthday} onChange={v => set('birthday', v)} />
            </FormField>
            <FormField label="亲密度">
              <Select value={String(personModal.closeness)} onChange={v => set('closeness', Number(v))}
                options={[5, 4, 3, 2, 1].map(n => ({ key: String(n), label: '❤'.repeat(n) }))} />
            </FormField>
          </Row>
          <FormField label="备注">
            <TextArea value={personModal.notes} onChange={v => set('notes', v)} rows={2}
              placeholder="TA 喜欢什么？在意什么？我想为 TA 做什么？" />
          </FormField>
          <ModalActions onCancel={() => setPersonModal(null)} disabled={!personModal.name}
            onSubmit={async () => {
              const { id, created_at: _ca, ...data } = personModal
              data.birthday = data.birthday || null
              if (id) await patch(id, data)
              else await add(data)
              setPersonModal(null)
            }} />
        </Modal>
      )}

      {detail && (
        <Modal title={`${REL_TYPES.find(t => t.key === detail.rel_type)?.icon} ${detail.name}`} onClose={() => setDetailId(null)} width={640}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            <Badge color={REL_TYPES.find(t => t.key === detail.rel_type)?.color}>
              {'❤'.repeat(detail.closeness || 3)}
            </Badge>
            {detail.birthday && <span style={{ fontSize: 13, color: COLORS.textLight }}>🎂 {fmtDate(detail.birthday)}</span>}
            <div style={{ flex: 1 }} />
            <IconBtn onClick={() => { setPersonModal({ ...detail, birthday: detail.birthday || '' }); setDetailId(null) }} color={COLORS.primary}>编辑</IconBtn>
            <IconBtn onClick={async () => { await del(detail.id); setDetailId(null) }} color={COLORS.red}>删除</IconBtn>
          </div>
          {detail.notes && <div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{detail.notes}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>互动记录</div>
            <IconBtn onClick={() => setLogModal({ ...emptyLog, person_id: detail.id })} color={COLORS.primary}>+ 记一笔</IconBtn>
          </div>
          {logsOf(detail.id).length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.textLight }}>见面、通话、值得记住的瞬间——记下来，感情需要经营</div>
          ) : logsOf(detail.id).map(l => (
            <div key={l.id} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '8px 0', fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: COLORS.textLight, whiteSpace: 'nowrap' }}>{l.log_date}</span>
                <span style={{ flex: 1 }}>{l.event}</span>
                <IconBtn onClick={() => delLog(l.id)} color={COLORS.red}>×</IconBtn>
              </div>
              {l.feeling && <div style={{ color: COLORS.pink, marginTop: 2 }}>💭 {l.feeling}</div>}
            </div>
          ))}
        </Modal>
      )}

      {logModal && (
        <Modal title="记录互动" onClose={() => setLogModal(null)}>
          <FormField label="日期">
            <TextInput type="date" value={logModal.log_date} onChange={v => setLogModal(d => ({ ...d, log_date: v }))} />
          </FormField>
          <FormField label="发生了什么" required>
            <TextArea value={logModal.event} onChange={v => setLogModal(d => ({ ...d, event: v }))} rows={3} />
          </FormField>
          <FormField label="我的感受">
            <TextInput value={logModal.feeling} onChange={v => setLogModal(d => ({ ...d, feeling: v }))} />
          </FormField>
          <ModalActions onCancel={() => setLogModal(null)} disabled={!logModal.event}
            onSubmit={async () => {
              await addLog(logModal)
              setLogModal(null)
            }} />
        </Modal>
      )}
    </div>
  )
}
