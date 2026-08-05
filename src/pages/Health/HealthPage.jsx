import { useState, useMemo } from 'react'
import { useTable } from '../../hooks/useTable'
import { COLORS, METRIC_TYPES } from '../../lib/constants'
import { Card, ScrollX } from '../../components/common/StatCard'
import { TrendChart } from '../../components/common/TrendChart'
import { Modal, ModalActions } from '../../components/common/Modal'
import { FormField, TextInput, TextArea, Select, Row } from '../../components/common/FormField'
import { EmptyState, AddButton, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDate, fmtDateTime, todayStr } from '../../lib/date'
import { uploadFile } from '../../lib/dataStore'
import { useUIStore } from '../../store/useUIStore'

const emptyMetric = { metric_type: 'weight', metric_name: '', value_num: '', value2_num: '', note: '', measured_date: todayStr() }
const emptyReport = { title: '', org: '', report_date: todayStr(), summary: '', file_url: '' }

export function HealthPage() {
  const [tab, setTab] = useState('metrics')
  const tabs = [
    { key: 'metrics', label: '📈 指标记录' },
    { key: 'reports', label: '📋 体检报告' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 14,
            border: `1px solid ${tab === t.key ? COLORS.primary : COLORS.border}`,
            background: tab === t.key ? COLORS.primary : '#fff',
            color: tab === t.key ? '#fff' : COLORS.text, fontWeight: tab === t.key ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>
      {tab === 'metrics' ? <MetricsTab /> : <ReportsTab />}
    </div>
  )
}

function MetricsTab() {
  const { rows, add, del } = useTable('health_metrics', { orderBy: 'measured_at', ascending: false })
  const [selType, setSelType] = useState('weight')
  const [modal, setModal] = useState(null)

  const typeDef = METRIC_TYPES.find(t => t.key === selType) || METRIC_TYPES[0]
  const typeRows = useMemo(
    () => rows.filter(r => r.metric_type === selType),
    [rows, selType],
  )
  const chartData = useMemo(
    () => [...typeRows].reverse().slice(-30).map(r => ({
      x: (r.measured_at || '').slice(0, 10),
      y: Number(r.value_num),
      y2: r.value2_num != null && r.value2_num !== '' ? Number(r.value2_num) : null,
    })),
    [typeRows],
  )

  const latest = typeRows[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {METRIC_TYPES.filter(t => t.key !== 'custom').map(t => (
          <button key={t.key} onClick={() => setSelType(t.key)} style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 13,
            border: `1px solid ${selType === t.key ? COLORS.primary : COLORS.border}`,
            background: selType === t.key ? '#EFF6FF' : '#fff',
            color: selType === t.key ? COLORS.primary : COLORS.text,
          }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <AddButton onClick={() => setModal({ ...emptyMetric, metric_type: selType })}>+ 记一笔</AddButton>
      </div>

      <Card title={`${typeDef.label} 趋势${typeDef.dual ? '（蓝=收缩压 / 橙=舒张压）' : ''}`}
        extra={latest && (
          <span style={{ fontSize: 13, color: COLORS.textLight }}>
            最近：<b style={{ color: COLORS.primary, fontSize: 16 }}>
              {latest.value_num}{latest.value2_num ? `/${latest.value2_num}` : ''}
            </b> {typeDef.unit} · {fmtDate(latest.measured_at)}
          </span>
        )}>
        <TrendChart data={chartData} unit={typeDef.unit} />
      </Card>

      <Card title="历史记录">
        {typeRows.length === 0 ? (
          <EmptyState icon="🩺" text={`还没有${typeDef.label}记录，点击"记一笔"开始`} />
        ) : (
          <ScrollX>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ color: COLORS.textLight, fontSize: 12, textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>时间</th>
                <th style={{ padding: '6px 8px' }}>数值</th>
                <th style={{ padding: '6px 8px' }}>备注</th>
                <th style={{ padding: '6px 8px', width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {typeRows.slice(0, 50).map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '8px' }}>{fmtDateTime(r.measured_at)}</td>
                  <td style={{ padding: '8px', fontWeight: 600 }}>
                    {r.value_num}{r.value2_num ? ` / ${r.value2_num}` : ''} <span style={{ color: COLORS.textLight, fontWeight: 400 }}>{r.unit}</span>
                  </td>
                  <td style={{ padding: '8px', color: COLORS.textLight }}>{r.note || '—'}</td>
                  <td><IconBtn onClick={() => del(r.id)} title="删除" color={COLORS.red}>删</IconBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollX>
        )}
      </Card>

      {modal && (
        <MetricModal
          draft={modal}
          setDraft={setModal}
          onClose={() => setModal(null)}
          onSubmit={async () => {
            const def = METRIC_TYPES.find(t => t.key === modal.metric_type)
            if (modal.value_num === '') return
            await add({
              metric_type: modal.metric_type,
              metric_name: modal.metric_type === 'custom' ? modal.metric_name : null,
              value_num: Number(modal.value_num),
              value2_num: def?.dual && modal.value2_num !== '' ? Number(modal.value2_num) : null,
              unit: modal.metric_type === 'custom' ? modal.unit || '' : def?.unit,
              measured_at: new Date(modal.measured_date + 'T12:00:00').toISOString(),
              note: modal.note || null,
            })
            setModal(null)
          }}
        />
      )}
    </div>
  )
}

function MetricModal({ draft, setDraft, onClose, onSubmit }) {
  const def = METRIC_TYPES.find(t => t.key === draft.metric_type) || METRIC_TYPES[0]
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  return (
    <Modal title="记录健康指标" onClose={onClose}>
      <FormField label="指标类型" required>
        <Select value={draft.metric_type} onChange={v => set('metric_type', v)} options={METRIC_TYPES} />
      </FormField>
      {draft.metric_type === 'custom' && (
        <Row>
          <FormField label="指标名称" required>
            <TextInput value={draft.metric_name} onChange={v => set('metric_name', v)} placeholder="如：尿酸" />
          </FormField>
          <FormField label="单位">
            <TextInput value={draft.unit} onChange={v => set('unit', v)} placeholder="如：μmol/L" />
          </FormField>
        </Row>
      )}
      <Row>
        <FormField label={def.dual ? def.labels[0] : `数值（${def.unit || '自定义单位'}）`} required>
          <TextInput type="number" value={draft.value_num} onChange={v => set('value_num', v)} />
        </FormField>
        {def.dual ? (
          <FormField label={def.labels[1]} required>
            <TextInput type="number" value={draft.value2_num} onChange={v => set('value2_num', v)} />
          </FormField>
        ) : (
          <FormField label="日期">
            <TextInput type="date" value={draft.measured_date} onChange={v => set('measured_date', v)} />
          </FormField>
        )}
      </Row>
      {def.dual && (
        <FormField label="日期">
          <TextInput type="date" value={draft.measured_date} onChange={v => set('measured_date', v)} />
        </FormField>
      )}
      <FormField label="备注">
        <TextInput value={draft.note} onChange={v => set('note', v)} placeholder="如：晨起空腹" />
      </FormField>
      <ModalActions onCancel={onClose} onSubmit={onSubmit} disabled={draft.value_num === ''} />
    </Modal>
  )
}

function ReportsTab() {
  const { rows, add, patch, del } = useTable('health_reports')
  const [modal, setModal] = useState(null)
  const [uploading, setUploading] = useState(false)
  const showToast = useUIStore(s => s.showToast)

  const set = (k, v) => setModal(d => ({ ...d, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={() => setModal({ ...emptyReport })}>+ 上传报告</AddButton>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon="📋" text="还没有体检报告。上传后永久保存，可随时回看与 AI 解读" /></Card>
      ) : rows.map(r => (
        <Card key={r.id} title={r.title}
          extra={
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Badge color={COLORS.teal}>{fmtDate(r.report_date)}</Badge>
              <IconBtn onClick={() => setModal({ ...r })} title="编辑">编辑</IconBtn>
              <IconBtn onClick={() => del(r.id)} title="删除" color={COLORS.red}>删</IconBtn>
            </div>
          }>
          <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 8 }}>
            {r.org ? `检测机构：${r.org}` : ''}
          </div>
          {r.summary && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{r.summary}</div>}
          {r.file_url && (
            <a href={r.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: COLORS.primary }}>
              📎 查看附件
            </a>
          )}
          {r.ai_review && (
            <div style={{
              marginTop: 10, padding: 12, background: '#F0F9FF', borderRadius: 8,
              fontSize: 13, whiteSpace: 'pre-wrap', border: '1px solid #BAE6FD',
            }}>🤖 {r.ai_review}</div>
          )}
        </Card>
      ))}

      {modal && (
        <Modal title={modal.id ? '编辑报告' : '上传体检报告'} onClose={() => setModal(null)}>
          <FormField label="报告标题" required>
            <TextInput value={modal.title} onChange={v => set('title', v)} placeholder="如：2026 年度体检" />
          </FormField>
          <Row>
            <FormField label="检测机构">
              <TextInput value={modal.org} onChange={v => set('org', v)} placeholder="如：美年大健康" />
            </FormField>
            <FormField label="报告日期">
              <TextInput type="date" value={modal.report_date} onChange={v => set('report_date', v)} />
            </FormField>
          </Row>
          <FormField label="附件（PDF/图片）" hint={modal.file_url ? '已有附件，重新选择将替换' : '演示模式限 1.5MB；连接 Supabase 后无限制'}>
            <input type="file" accept=".pdf,image/*" onChange={async e => {
              const f = e.target.files?.[0]
              if (!f) return
              setUploading(true)
              try {
                const url = await uploadFile(f)
                set('file_url', url)
                showToast('附件已就绪')
              } catch (err) {
                showToast(err.message, 'error')
              } finally {
                setUploading(false)
              }
            }} />
          </FormField>
          <FormField label="关键结果摘要" hint="把重要指标/结论记下来，方便 AI 解读与日后回看">
            <TextArea value={modal.summary} onChange={v => set('summary', v)} rows={5} />
          </FormField>
          <ModalActions
            onCancel={() => setModal(null)}
            disabled={!modal.title || uploading}
            submitText={uploading ? '上传中…' : '保存'}
            onSubmit={async () => {
              const { id, created_at: _ca, ai_review: _ar, ...data } = modal
              if (id) await patch(id, data)
              else await add(data)
              setModal(null)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
