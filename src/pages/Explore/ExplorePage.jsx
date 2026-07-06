import { useState } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, EXPLORE_CATEGORIES } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDate, todayStr } from '../../lib/date'
import { uploadFile } from '../../lib/dataStore'
import { useUIStore } from '../../store/useUIStore'

const emptyRec = { title: '', category: 'food', record_date: todayStr(), location: '', rating: 5, content: '', photo_url: '' }

export function ExplorePage() {
  const { rows, add, patch, del } = useTable('explore_records', { orderBy: 'record_date', ascending: false })
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [uploading, setUploading] = useState(false)
  const showToast = useUIStore(s => s.showToast)
  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  const filtered = filter === 'all' ? rows : rows.filter(r => r.category === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <CatBtn active={filter === 'all'} onClick={() => setFilter('all')}>全部（{rows.length}）</CatBtn>
        {EXPLORE_CATEGORIES.map(c => (
          <CatBtn key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>
            {c.icon} {c.label}（{rows.filter(r => r.category === c.key).length}）
          </CatBtn>
        ))}
        <div style={{ flex: 1 }} />
        <AddButton onClick={() => setModal({ ...emptyRec })}>+ 记录美好</AddButton>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon="🧭" text="去经历、去感受，把生活的美好记录在这里" /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(r => {
            const cat = EXPLORE_CATEGORIES.find(c => c.key === r.category)
            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                {r.photo_url && (
                  <img src={r.photo_url} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Badge color={COLORS.teal}>{cat?.icon} {cat?.label}</Badge>
                    <span style={{ fontSize: 12, color: COLORS.textLight }}>{fmtDate(r.record_date)}</span>
                    <div style={{ flex: 1 }} />
                    <IconBtn onClick={() => setModal({ ...r })} color={COLORS.primary}>编辑</IconBtn>
                    <IconBtn onClick={() => del(r.id)} color={COLORS.red}>删</IconBtn>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{r.title}</div>
                  {r.location && <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 4 }}>📍 {r.location}</div>}
                  {r.rating && <div style={{ fontSize: 13, marginBottom: 6 }}>{'⭐'.repeat(Math.min(5, r.rating))}</div>}
                  {r.content && <div style={{ fontSize: 13, color: COLORS.text, whiteSpace: 'pre-wrap' }}>{r.content}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? '编辑记录' : '记录美好'} onClose={() => setModal(null)}>
          <FormField label="标题" required>
            <TextInput value={modal.title} onChange={v => set('title', v)} placeholder="如：巷口那家隐藏日料" />
          </FormField>
          <Row>
            <FormField label="分类">
              <Select value={modal.category} onChange={v => set('category', v)}
                options={EXPLORE_CATEGORIES.map(c => ({ key: c.key, label: `${c.icon} ${c.label}` }))} />
            </FormField>
            <FormField label="日期">
              <TextInput type="date" value={modal.record_date} onChange={v => set('record_date', v)} />
            </FormField>
          </Row>
          <Row>
            <FormField label="地点">
              <TextInput value={modal.location} onChange={v => set('location', v)} />
            </FormField>
            <FormField label="评分">
              <Select value={String(modal.rating)} onChange={v => set('rating', Number(v))}
                options={[5, 4, 3, 2, 1].map(n => ({ key: String(n), label: '⭐'.repeat(n) }))} />
            </FormField>
          </Row>
          <FormField label="感受 / 记录">
            <TextArea value={modal.content} onChange={v => set('content', v)} rows={4}
              placeholder="味道如何？看到了什么？有什么新认知？" />
          </FormField>
          <FormField label="照片" hint={modal.photo_url ? '已有照片，重新选择将替换' : ''}>
            <input type="file" accept="image/*" onChange={async e => {
              const f = e.target.files?.[0]
              if (!f) return
              setUploading(true)
              try {
                set('photo_url', await uploadFile(f))
                showToast('照片已就绪')
              } catch (err) {
                showToast(err.message, 'error')
              } finally {
                setUploading(false)
              }
            }} />
          </FormField>
          <ModalActions onCancel={() => setModal(null)} disabled={!modal.title || uploading}
            submitText={uploading ? '上传中…' : '保存'}
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

function CatBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 999, fontSize: 13,
      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
      background: active ? '#EFF6FF' : '#fff',
      color: active ? COLORS.primary : COLORS.text,
    }}>{children}</button>
  )
}
