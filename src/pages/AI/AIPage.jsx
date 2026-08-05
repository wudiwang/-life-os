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
        throw new Error('在线 AI 接口未配置。可在自己电脑上运行 npm run ai（走本机 Claude Code 订阅，结果会出现在下方历史里）')
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
          两种方式：① 此处在线分析（需 Vercel 配 CLAUDE_API_KEY）；② 电脑上运行 <code>npm run ai [模块] [问题]</code>，
          走本机 Claude Code 订阅（不花 API 费），结果自动存入下方历史，手机也能看。
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
