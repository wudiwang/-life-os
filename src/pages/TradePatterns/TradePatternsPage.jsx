import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Badge } from '../../components/common/Badge'
import { AddButton, EmptyState, IconBtn } from '../../components/common/EmptyState'
import { FormField, Row, Select, TextArea, TextInput } from '../../components/common/FormField'
import { Modal, ModalActions } from '../../components/common/Modal'
import { TableMissing } from '../../components/common/TableMissing'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTable } from '../../hooks/useTable'
import { COLORS, TRADE_PATTERN_STATUS } from '../../lib/constants'
import { uploadFile } from '../../lib/dataStore'
import { fmtDate } from '../../lib/date'
import { useUIStore } from '../../store/useUIStore'
import { excerpt, filterPatterns, normalizeDraft, syncLabel } from './tradePatternUtils'

const emptyDraft = {
  title: '', original_quote: '', symbol: '', timeframe: '', tags: '',
  direction: 'unknown', image_file: null,
}

const directionOptions = [
  { key: 'unknown', label: '方向待定' }, { key: 'short', label: '偏空' },
  { key: 'long', label: '偏多' }, { key: 'both', label: '双向' },
]

const statusOf = key => TRADE_PATTERN_STATUS.find(item => item.key === key) || TRADE_PATTERN_STATUS[0]
const beijingDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

function Section({ title, children }) {
  if (!children) return null
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 8px', color: COLORS.text }}>{title}</h3>
      <div className="md-body" style={{ fontSize: 14, lineHeight: 1.75, color: COLORS.text }}>
        {typeof children === 'string' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown> : children}
      </div>
    </section>
  )
}

export function TradePatternsPage() {
  const patterns = useTable('trade_patterns', { optional: true, orderBy: 'origin_date' })
  const updates = useTable('trade_pattern_updates', { optional: true, orderBy: 'event_date' })
  const isMobile = useIsMobile()
  const showToast = useUIStore(state => state.showToast)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const visible = useMemo(
    () => filterPatterns(patterns.rows, { query, status }),
    [patterns.rows, query, status],
  )
  const counts = useMemo(() => Object.fromEntries(
    ['all', ...TRADE_PATTERN_STATUS.map(item => item.key)].map(key => [
      key, key === 'all' ? patterns.rows.length : patterns.rows.filter(row => row.status === key).length,
    ]),
  ), [patterns.rows])
  const selectedUpdates = selected
    ? updates.rows.filter(row => row.pattern_id === selected.id) : []
  const setDraftValue = (key, value) => setDraft(current => ({ ...current, [key]: value }))

  if (patterns.missing) return <TableMissing sql="v10_trade_patterns.sql" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {updates.missing && <TableMissing sql="v10_trade_patterns.sql" />}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(120px, 1fr))', gap: 10 }}>
        {[{ key: 'all', label: '全部形态', color: COLORS.text }, ...TRADE_PATTERN_STATUS.slice(0, 4)].map(item => (
          <button key={item.key} onClick={() => setStatus(item.key)} style={{
            textAlign: 'left', padding: 12, borderRadius: 10, cursor: 'pointer',
            background: status === item.key ? `${item.color}12` : '#fff',
            border: `1px solid ${status === item.key ? item.color : COLORS.border}`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{counts[item.key] || 0}</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{item.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={query} onChange={event => setQuery(event.target.value)}
          placeholder="🔍 搜索标题、原话、规律、标签…" style={{
            flex: '1 1 230px', minWidth: 0, padding: '9px 12px', borderRadius: 8,
            border: `1px solid ${COLORS.border}`, fontSize: 14,
          }} />
        <select value={status} onChange={event => setStatus(event.target.value)} style={{
          padding: '9px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
        }}>
          <option value="all">全部状态</option>
          {TRADE_PATTERN_STATUS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <AddButton onClick={() => setDraft({ ...emptyDraft })}>+ 收藏新形态</AddButton>
      </div>

      <div style={{ fontSize: 13, color: COLORS.textLight }}>
        原图与原话永久保留；归纳规律、回测和证伪沿时间线继续沉淀。当前显示 {visible.length} 条。
      </div>

      {!patterns.loading && visible.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
          <EmptyState icon="📐" text="还没有符合筛选条件的交易形态" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {visible.map(pattern => {
            const patternStatus = statusOf(pattern.status)
            return (
              <article key={pattern.id} onClick={() => setSelected(pattern)} style={{
                background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12,
                overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: 260,
              }}>
                {pattern.image_url ? (
                  <img src={pattern.image_url} alt={pattern.title} loading="lazy" style={{ width: '100%', height: 170, objectFit: 'cover', background: COLORS.bg }} />
                ) : <div style={{ height: 90, display: 'grid', placeItems: 'center', background: COLORS.bg, fontSize: 28 }}>📈</div>}
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: 15, lineHeight: 1.45, flex: 1 }}>{pattern.title}</strong>
                    <Badge color={patternStatus.color}>{patternStatus.label}</Badge>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: COLORS.textLight }}>
                    {excerpt(pattern.original_quote || pattern.hypotheses || '尚未填写原话', 92)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto' }}>
                    {(pattern.tags || []).slice(0, 4).map(tag => <Badge key={tag} color={COLORS.gray}>#{tag}</Badge>)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: COLORS.textLight }}>
                    <span>{pattern.source_key}</span><span>{fmtDate(pattern.origin_date)} · {syncLabel(pattern.sync_state)}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)} width={820}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge color={statusOf(selected.status).color}>{statusOf(selected.status).label}</Badge>
            <Badge color={selected.sync_state === 'sync_error' ? COLORS.red : selected.sync_state === 'synced' ? COLORS.green : COLORS.orange}>
              {syncLabel(selected.sync_state)}
            </Badge>
            {(selected.tags || []).map(tag => <Badge key={tag} color={COLORS.gray}>#{tag}</Badge>)}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.textLight }}>{selected.source_key}</span>
          </div>
          {selected.sync_error && <div style={{ marginTop: 10, color: COLORS.red, fontSize: 12 }}>同步错误：{selected.sync_error}</div>}
          <Section title="1. 初始形态">
            <div>
              {selected.image_url && <img src={selected.image_url} alt={selected.title} style={{ width: '100%', maxHeight: 560, objectFit: 'contain', borderRadius: 10, background: COLORS.bg }} />}
              <div style={{ marginTop: 10, fontSize: 12, color: COLORS.textLight }}>
                {fmtDate(selected.origin_date)}{selected.symbol ? ` · ${selected.symbol}` : ''}{selected.timeframe ? ` · ${selected.timeframe}` : ''}
              </div>
              {selected.original_quote && <blockquote style={{ margin: '12px 0 0', padding: '10px 14px', borderLeft: `3px solid ${COLORS.primary}`, background: '#EFF6FF', whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{selected.original_quote}</blockquote>}
            </div>
          </Section>
          <Section title="2. 图中事实">{selected.observations}</Section>
          <Section title="3. 归纳规律">{selected.hypotheses}</Section>
          <Section title="4. 待定项">{selected.pending_questions}</Section>
          <Section title="5. 研究时间线">
            {selectedUpdates.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedUpdates.map(update => (
                  <div key={update.id} style={{ borderLeft: `2px solid ${COLORS.border}`, paddingLeft: 12 }}>
                    <div style={{ fontSize: 12, color: COLORS.textLight }}>{fmtDate(update.event_date)} · {update.title}</div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: COLORS.textLight }}>暂无研究更新</div>}
          </Section>
          {selected.sync_state !== 'synced' && selected.created_via === 'life_os_uploading' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <IconBtn color={COLORS.red} onClick={async () => {
                if (!window.confirm('只删除尚未写回交易项目的草稿，确认删除？')) return
                await patterns.del(selected.id)
                setSelected(null)
              }}>删除草稿</IconBtn>
            </div>
          )}
        </Modal>
      )}

      {draft && (
        <Modal title="收藏新交易形态" onClose={() => !saving && setDraft(null)} width={700}>
          <FormField label="截图" required hint="保存后先进入待写回队列，不会触发策略或自动下单。">
            <input type="file" accept="image/*" onChange={event => setDraftValue('image_file', event.target.files?.[0] || null)} />
          </FormField>
          <FormField label="标题" hint="标题和原话至少填写一项">
            <TextInput value={draft.title} onChange={value => setDraftValue('title', value)} placeholder="如：强势币见顶后的弱反弹续跌" />
          </FormField>
          <FormField label="你的原话" hint="按原样保存，不会被 AI 改写成规则">
            <TextArea value={draft.original_quote} onChange={value => setDraftValue('original_quote', value)} rows={6} />
          </FormField>
          <Row cols={isMobile ? '1fr' : 'repeat(3, 1fr)'}>
            <FormField label="标的"><TextInput value={draft.symbol} onChange={value => setDraftValue('symbol', value)} placeholder="如 ONGUSDT" /></FormField>
            <FormField label="周期"><TextInput value={draft.timeframe} onChange={value => setDraftValue('timeframe', value)} placeholder="如 5分钟" /></FormField>
            <FormField label="方向"><Select value={draft.direction} onChange={value => setDraftValue('direction', value)} options={directionOptions} /></FormField>
          </Row>
          <FormField label="标签" hint="用逗号分隔"><TextInput value={draft.tags} onChange={value => setDraftValue('tags', value)} placeholder="强势币, 见顶, 做空" /></FormField>
          <ModalActions onCancel={() => setDraft(null)} submitText={saving ? '保存中…' : '保存并等待写回'}
            disabled={saving || !draft.image_file || (!draft.title.trim() && !draft.original_quote.trim())}
            onSubmit={async () => {
              setSaving(true)
              let recordId = draft.record_id
              let imageUrl = draft.uploaded_url
              try {
                const date = draft.origin_date || beijingDate()
                const webUuid = draft.web_uuid || crypto.randomUUID()
                const row = normalizeDraft({ ...draft, image_url: null }, webUuid, date)
                if (!row.title) row.title = excerpt(row.original_quote.trim().replace(/\s+/g, ' '), 32) || `未命名形态 · ${date}`
                if (!recordId) {
                  const saved = await patterns.add({ ...row, created_via: 'life_os_uploading' })
                  recordId = saved.id
                  setDraft(current => ({ ...current, record_id: recordId, web_uuid: webUuid, origin_date: date }))
                }
                if (!imageUrl) {
                  imageUrl = await uploadFile(draft.image_file)
                  setDraft(current => ({ ...current, uploaded_url: imageUrl }))
                  await patterns.patch(recordId, { image_url: imageUrl })
                }
                await patterns.patch(recordId, {
                  ...row, image_url: imageUrl, created_via: 'life_os',
                  sync_state: 'pending_writeback', sync_error: null,
                })
                setDraft(null)
                showToast('已收藏，等待本地同步写回交易研究档案')
              } catch (error) {
                if (recordId) {
                  try {
                    await patterns.patch(recordId, {
                      sync_state: 'sync_error', sync_error: error.message,
                    })
                  } catch { /* useTable 已显示数据库错误 */ }
                }
                showToast(`保存未完成：${error.message}`, 'error')
              } finally {
                setSaving(false)
              }
            }} />
        </Modal>
      )}
    </div>
  )
}
