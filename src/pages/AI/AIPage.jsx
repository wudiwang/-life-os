import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTable } from '../../hooks/useTable'
import { COLORS } from '../../lib/constants'
import { AI_MODULES, buildSummary } from '../../lib/aiSummary'
import { Card } from '../../components/common/StatCard'
import { EmptyState, IconBtn } from '../../components/common/EmptyState'
import { Badge } from '../../components/common/Badge'
import { fmtDateTime } from '../../lib/date'
import { useUIStore } from '../../store/useUIStore'

export function AIPage() {
  const { rows: history, add, del } = useTable('ai_reviews')
  const [selModule, setSelModule] = useState('overall')
  const [question, setQuestion] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const showToast = useUIStore(s => s.showToast)

  const run = async () => {
    setRunning(true)
    setResult(null)
    try {
      const dataSummary = await buildSummary(selModule)
      const resp = await fetch('/api/ai-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          module: AI_MODULES.find(m => m.key === selModule)?.label,
          dataSummary,
          question: question || undefined,
        }),
      })
      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('AI 接口不可用。本地开发环境无 Serverless 支持，请部署到 Vercel 后使用（部署指南见项目文档）')
      }
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'AI 分析失败')
      setResult(data.content)
      await add({
        module: selModule,
        prompt_summary: question || '常规分析',
        content: data.content,
      })
    } catch (e) {
      showToast(e.message, 'error')
      setResult(`⚠️ ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="🤖 让 AI 分析我的数据">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {AI_MODULES.map(m => (
            <button key={m.key} onClick={() => setSelModule(m.key)} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13,
              border: `1px solid ${selModule === m.key ? COLORS.primary : COLORS.border}`,
              background: selModule === m.key ? '#EFF6FF' : '#fff',
              color: selModule === m.key ? COLORS.primary : COLORS.text,
            }}>{m.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="（可选）具体想问什么？如：我最近的体重趋势正常吗？"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, outline: 'none' }} />
          <button onClick={run} disabled={running} style={{
            padding: '9px 22px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600,
            background: running ? COLORS.border : COLORS.primary, color: '#fff',
          }}>{running ? '分析中…' : '开始分析'}</button>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 8 }}>
          AI 会读取所选模块的近期数据（在你自己的服务端调用 Claude，密钥不经过前端）。
        </div>
      </Card>

      {result && (
        <Card title="分析结果">
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        </Card>
      )}

      <Card title={`历史分析（${history.length}）`}>
        {history.length === 0 ? (
          <EmptyState icon="🗂️" text="分析结果会自动留档，方便回看对比" />
        ) : history.slice(0, 20).map(h => (
          <details key={h.id} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '10px 0' }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge color={COLORS.purple}>{AI_MODULES.find(m => m.key === h.module)?.label || h.module}</Badge>
              <span style={{ color: COLORS.textLight, fontSize: 12 }}>{fmtDateTime(h.created_at)}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.prompt_summary}</span>
              <IconBtn onClick={e => { e.preventDefault(); del(h.id) }} color={COLORS.red}>删</IconBtn>
            </summary>
            <div style={{ fontSize: 13, lineHeight: 1.7, padding: '8px 4px' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{h.content}</ReactMarkdown>
            </div>
          </details>
        ))}
      </Card>
    </div>
  )
}
