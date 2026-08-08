import { useState, useMemo } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, FOCUS_TRACKS, TRACK_OTHER, trackOf } from '../../lib/constants'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select } from '../../components/common/FormField'
import { Badge } from '../../components/common/Badge'
import { IconBtn } from '../../components/common/EmptyState'
import { todayStr } from '../../lib/date'

// 每天换一条，但一天之内稳定——用日期做种子，而不是随机
const daySeed = () => Math.floor(Date.parse(todayStr()) / 86400000)

const TRACK_OPTIONS = [...FOCUS_TRACKS, TRACK_OTHER].map(t => ({ key: t.key, label: `${t.icon} ${t.label}` }))

export function InsightBar() {
  const { rows, add, patch, del } = useTable('insights', { orderBy: 'hits', ascending: false, optional: true })
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const active = useMemo(() => rows.filter(r => r.active !== false), [rows])
  if (active.length === 0) return null

  const cur = active[(daySeed() + step) % active.length]
  const t = trackOf(cur.track)

  const save = async () => {
    const { id, created_at: _c, updated_at: _u, ...data } = editing
    const payload = { ...data, updated_at: new Date().toISOString() }
    if (id) await patch(id, payload)
    else await add({ ...payload, hits: 1, active: true })
    setEditing(null)
  }

  return (
    <>
      <div style={{
        background: `linear-gradient(135deg, ${t.color}14, ${t.color}05)`,
        border: `1px solid ${t.color}44`, borderRadius: 12, padding: '13px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: t.color, fontWeight: 600 }}>💡 今日启示</span>
          {cur.hits > 1 && <Badge color={COLORS.orange}>你念叨过 {cur.hits} 次</Badge>}
          <div style={{ flex: 1 }} />
          <IconBtn onClick={() => { setStep(s => s + 1); setExpanded(false) }} color={COLORS.textLight}>换一条</IconBtn>
          <IconBtn onClick={() => setOpen(true)} color={COLORS.primary}>全部 {active.length}</IconBtn>
        </div>

        <div onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55 }}>{cur.title}</div>
          {expanded
            ? (
              <>
                {cur.detail && (
                  <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.75, marginTop: 8 }}>{cur.detail}</div>
                )}
                {cur.source_quote && (
                  <div style={{
                    fontSize: 12, color: COLORS.textLight, lineHeight: 1.6, marginTop: 8,
                    paddingLeft: 10, borderLeft: `2px solid ${COLORS.border}`,
                  }}>
                    「{cur.source_quote}」{cur.source_date && ` · ${cur.source_date}`}
                  </div>
                )}
              </>
            )
            : cur.detail && (
              <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>点开看怎么用 ›</div>
            )}
        </div>
      </div>

      {open && (
        <Modal title={`💡 全部启示（${active.length}）`} onClose={() => setOpen(false)} width={620}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <IconBtn onClick={() => setEditing({ title: '', detail: '', track: 'work', source_quote: '', source_date: todayStr() })}
              color={COLORS.primary}>+ 手写一条</IconBtn>
          </div>
          {rows.map(r => {
            const rt = trackOf(r.track)
            const off = r.active === false
            return (
              <div key={r.id} style={{
                border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px',
                marginBottom: 8, opacity: off ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <Badge color={rt.color}>{rt.icon} {rt.short}</Badge>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{r.title}</span>
                  {r.hits > 1 && <Badge color={COLORS.orange}>×{r.hits}</Badge>}
                </div>
                {r.detail && (
                  <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.7 }}>{r.detail}</div>
                )}
                <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                  <IconBtn onClick={() => setEditing({ ...r })} color={COLORS.primary}>编辑</IconBtn>
                  <IconBtn onClick={() => patch(r.id, { active: off })} color={COLORS.orange}>
                    {off ? '启用' : '停用'}
                  </IconBtn>
                  <IconBtn onClick={() => del(r.id)} color={COLORS.red}>删</IconBtn>
                </div>
              </div>
            )
          })}
        </Modal>
      )}

      {editing && (
        <Modal title={editing.id ? '编辑启示' : '新启示'} onClose={() => setEditing(null)}>
          <FormField label="一句话启示" required>
            <TextInput value={editing.title} onChange={v => setEditing(d => ({ ...d, title: v }))}
              placeholder="如：迭代必须先有方向，否则等于原地打转" />
          </FormField>
          <FormField label="以后怎么用" hint="为什么成立 + 下次遇到同类情况该怎么做">
            <TextArea value={editing.detail} onChange={v => setEditing(d => ({ ...d, detail: v }))} rows={5} />
          </FormField>
          <FormField label="归属方向">
            <Select value={editing.track} onChange={v => setEditing(d => ({ ...d, track: v }))} options={TRACK_OPTIONS} />
          </FormField>
          <ModalActions onCancel={() => setEditing(null)} onSubmit={save} disabled={!editing.title?.trim()} />
        </Modal>
      )}
    </>
  )
}
