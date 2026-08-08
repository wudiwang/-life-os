import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS, FOCUS_TRACKS, TRACK_OTHER, THREAD_STATUS, trackOf } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select } from '../../components/common/FormField'
import { Badge } from '../../components/common/Badge'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'

const TRACK_OPTIONS = [...FOCUS_TRACKS, TRACK_OTHER].map(t => ({ key: t.key, label: `${t.icon} ${t.label}` }))
const STATUS_OPTIONS = THREAD_STATUS.map(s => ({ key: s.key, label: s.label }))
const emptyThread = { title: '', track: 'work', summary: '', next_action: '', status: 'active', sort_order: 99 }

function ThreadCard({ row, onEdit }) {
  const [open, setOpen] = useState(false)
  const t = trackOf(row.track)
  const st = THREAD_STATUS.find(s => s.key === row.status)

  return (
    <div style={{
      border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${t.color}`,
      borderRadius: 10, padding: '12px 14px', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14 }}>{t.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0, lineHeight: 1.5 }}>{row.title}</span>
        {row.status !== 'active' && <Badge color={st?.color}>{st?.label}</Badge>}
      </div>

      {row.summary && (
        <div onClick={() => setOpen(o => !o)} style={{
          fontSize: 13, color: COLORS.textLight, lineHeight: 1.7, whiteSpace: 'pre-wrap', cursor: 'pointer',
          ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}>{row.summary}</div>
      )}

      {row.next_action && (
        <div style={{
          background: t.color + '0D', border: `1px solid ${t.color}33`, borderRadius: 8,
          padding: '8px 10px', fontSize: 13, lineHeight: 1.6,
        }}>
          <span style={{ color: t.color, fontWeight: 600 }}>▶ 下一步 </span>{row.next_action}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: COLORS.textLight, flex: 1 }}>
          {row.mention_count > 0 ? `随笔里提到 ${row.mention_count} 次` : '还没在随笔里提过'}
        </span>
        <IconBtn onClick={() => onEdit(row)} color={COLORS.primary}>编辑</IconBtn>
      </div>
    </div>
  )
}

export function ThreadsPanel() {
  const isMobile = useIsMobile()
  const { rows, add, patch, del } = useTable('journal_threads', { orderBy: 'sort_order', ascending: true, optional: true })
  const [editing, setEditing] = useState(null)
  const [showRest, setShowRest] = useState(false)

  const active = rows.filter(r => r.status === 'active')
  const rest = rows.filter(r => r.status !== 'active')

  const save = async () => {
    const { id, created_at: _c, updated_at: _u, ...data } = editing
    const payload = { ...data, updated_at: new Date().toISOString() }
    if (id) await patch(id, payload)
    else await add(payload)
    setEditing(null)
  }

  return (
    <Card
      title="🧵 我的主线"
      extra={<AddButton onClick={() => setEditing({ ...emptyThread })}>+ 新主线</AddButton>}
    >
      {rows.length === 0 ? (
        <EmptyState icon="🧵" text="还没有主线。主线是你长期在推进的那几条线——随笔再杂，落点也就那么几个" />
      ) : (
        <div style={{
          display: 'grid', gap: 10,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
        }}>
          {active.map(r => <ThreadCard key={r.id} row={r} onEdit={setEditing} />)}
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <IconBtn onClick={() => setShowRest(s => !s)} color={COLORS.textLight}>
            {showRest ? '收起' : `搁置/已完成 ${rest.length} 条 ›`}
          </IconBtn>
          {showRest && (
            <div style={{
              display: 'grid', gap: 10, marginTop: 10,
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
            }}>
              {rest.map(r => <ThreadCard key={r.id} row={r} onEdit={setEditing} />)}
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? '编辑主线' : '新主线'} onClose={() => setEditing(null)} width={620}>
          <FormField label="主线标题" required>
            <TextInput value={editing.title} onChange={v => setEditing(d => ({ ...d, title: v }))}
              placeholder="如：把 PM 的职责边界做到「让人无话可说」" />
          </FormField>
          <FormField label="当前结论 / 进展" hint="这条线你目前想清楚了什么">
            <TextArea value={editing.summary} onChange={v => setEditing(d => ({ ...d, summary: v }))} rows={5} />
          </FormField>
          <FormField label="下一步" hint="具体到能直接去做的一件事">
            <TextInput value={editing.next_action} onChange={v => setEditing(d => ({ ...d, next_action: v }))} />
          </FormField>
          <FormField label="归属方向">
            <Select value={editing.track} onChange={v => setEditing(d => ({ ...d, track: v }))} options={TRACK_OPTIONS} />
          </FormField>
          <FormField label="状态">
            <Select value={editing.status} onChange={v => setEditing(d => ({ ...d, status: v }))} options={STATUS_OPTIONS} />
          </FormField>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {editing.id && <IconBtn onClick={async () => { await del(editing.id); setEditing(null) }} color={COLORS.red}>删除这条主线</IconBtn>}
            <div style={{ flex: 1 }} />
          </div>
          <ModalActions onCancel={() => setEditing(null)} onSubmit={save} disabled={!editing.title?.trim()} />
        </Modal>
      )}
    </Card>
  )
}
