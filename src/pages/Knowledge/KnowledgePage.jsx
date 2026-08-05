import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTable } from '../../hooks/useTable'
import { COLORS } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDate } from '../../lib/date'
import { uploadFile } from '../../lib/dataStore'
import { useUIStore } from '../../store/useUIStore'

const emptyNote = { title: '', category: '', tags: '', content: '', source: '', file_url: '' }

export function KnowledgePage() {
  const { rows, add, patch, del } = useTable('knowledge_notes')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [reading, setReading] = useState(null)
  const [uploading, setUploading] = useState(false)
  const showToast = useUIStore(s => s.showToast)
  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  const categories = useMemo(
    () => [...new Set(rows.map(r => r.category).filter(Boolean))],
    [rows],
  )

  const filtered = rows.filter(r => {
    if (catFilter !== 'all' && r.category !== catFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return [r.title, r.content, r.tags, r.category].some(f => (f || '').toLowerCase().includes(s))
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 搜索标题/内容/标签…"
          style={{ flex: '1 1 220px', padding: '8px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, outline: 'none' }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>
          <option value="all">全部分类</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <AddButton onClick={() => setModal({ ...emptyNote })}>+ 记入大脑</AddButton>
      </div>

      <div style={{ fontSize: 13, color: COLORS.textLight }}>
        🧠 外挂大脑已积累 <b style={{ color: COLORS.primary }}>{rows.length}</b> 条知识/感悟
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon="🧠" text="专业知识、生活感悟、值得留存的信息——都放进外挂大脑" /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(r => (
            <div key={r.id} onClick={() => setReading(r)} style={{
              background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`,
              padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: COLORS.textLight, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {(r.content || '').slice(0, 150)}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto' }}>
                {r.category && <Badge color={COLORS.purple}>{r.category}</Badge>}
                {(r.tags || '').split(/[,，]/).filter(Boolean).slice(0, 3).map(t => (
                  <Badge key={t} color={COLORS.gray}>#{t.trim()}</Badge>
                ))}
                <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: 'auto' }}>{fmtDate(r.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {reading && (
        <Modal title={reading.title} onClose={() => setReading(null)} width={760}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {reading.category && <Badge color={COLORS.purple}>{reading.category}</Badge>}
            {(reading.tags || '').split(/[,，]/).filter(Boolean).map(t => <Badge key={t} color={COLORS.gray}>#{t.trim()}</Badge>)}
            <div style={{ flex: 1 }} />
            <IconBtn onClick={() => { setModal({ ...reading }); setReading(null) }} color={COLORS.primary}>编辑</IconBtn>
            <IconBtn onClick={async () => { await del(reading.id); setReading(null) }} color={COLORS.red}>删除</IconBtn>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8 }} className="md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reading.content || ''}</ReactMarkdown>
          </div>
          {reading.file_url && (
            <div style={{ marginTop: 14 }}>
              <a href={reading.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: COLORS.primary }}>
                📎 打开附件（原始文档）
              </a>
            </div>
          )}
          {reading.source && (
            <div style={{ marginTop: 14, fontSize: 13, color: COLORS.textLight }}>来源：{reading.source}</div>
          )}
        </Modal>
      )}

      {modal && (
        <Modal title={modal.id ? '编辑' : '记入大脑'} onClose={() => setModal(null)} width={720}>
          <FormField label="标题" required>
            <TextInput value={modal.title} onChange={v => set('title', v)} />
          </FormField>
          <Row>
            <FormField label="分类" hint="自由填写，如：专业 / 感悟 / 收藏">
              <TextInput value={modal.category} onChange={v => set('category', v)} />
            </FormField>
            <FormField label="标签" hint="逗号分隔">
              <TextInput value={modal.tags} onChange={v => set('tags', v)} placeholder="如：管理, 沟通" />
            </FormField>
          </Row>
          <FormField label="内容（支持 Markdown）" required>
            <TextArea value={modal.content} onChange={v => set('content', v)} rows={10} />
          </FormField>
          <FormField label="来源">
            <TextInput value={modal.source} onChange={v => set('source', v)} placeholder="链接 / 书名 / 出处" />
          </FormField>
          <FormField label="附件（文档/模板/图片）"
            hint={modal.file_url ? '已有附件，重新选择将替换' : '如需求文档、模板文件；正文里写清"这是什么、何时用"'}>
            <input type="file" onChange={async e => {
              const f = e.target.files?.[0]
              if (!f) return
              setUploading(true)
              try {
                set('file_url', await uploadFile(f))
                showToast('附件已就绪')
              } catch (err) {
                showToast(err.message, 'error')
              } finally {
                setUploading(false)
              }
            }} />
          </FormField>
          <ModalActions onCancel={() => setModal(null)} disabled={!modal.title || !modal.content || uploading}
            submitText={uploading ? '上传中…' : '保存'}
            onSubmit={async () => {
              const { id, created_at: _ca, updated_at: _ua, ...data } = modal
              if (id) await patch(id, { ...data, updated_at: new Date().toISOString() })
              else await add(data)
              setModal(null)
            }} />
        </Modal>
      )}
    </div>
  )
}
