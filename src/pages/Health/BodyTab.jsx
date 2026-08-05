import { useState, useMemo } from 'react'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { COLORS, BODY_METRICS } from '../../lib/constants'
import { Card, ScrollX } from '../../components/common/StatCard'
import { TrendChart } from '../../components/common/TrendChart'
import { EmptyState } from '../../components/common/EmptyState'
import { fmtDateTime } from '../../lib/date'
import { db, isDemo } from '../../lib/dataStore'
import { useUIStore } from '../../store/useUIStore'

// 一次体测 = 同一天记了 ≥3 项体成分指标。单独补记的体重不算体测日，
// 否则对比表会被一堆只有体重的列稀释，看不出 InBody 的变化。
const SESSION_MIN_ITEMS = 3
const sleep = ms => new Promise(r => setTimeout(r, ms))

function delta(cur, prev, good) {
  if (cur == null || prev == null) return null
  const diff = +(cur - prev).toFixed(2)
  if (diff === 0) return { text: '持平', color: COLORS.gray }
  const better = good === 'up' ? diff > 0 : diff < 0
  return { text: `${diff > 0 ? '↑' : '↓'}${Math.abs(diff)}`, color: better ? COLORS.green : COLORS.red }
}

export function BodyTab() {
  const { rows } = useTable('health_metrics', { orderBy: 'measured_at', ascending: true })
  const { rows: reviews, reload: reloadReviews } = useTable('ai_reviews', { orderBy: 'created_at', ascending: false })
  const [chartKey, setChartKey] = useState('body_fat')
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState('')
  const showToast = useUIStore(s => s.showToast)
  const isMobile = useIsMobile()

  // 把 health_metrics 拍平成 {指标 → {日期 → 数值}}
  const { byKey, allDates, sessionDates } = useMemo(() => {
    const map = {}
    const perDate = {}
    for (const r of rows) {
      const key = r.metric_type === 'custom' ? r.metric_name : r.metric_type
      if (!BODY_METRICS.some(m => m.key === key)) continue
      const d = (r.measured_at || '').slice(0, 10)
      if (!d) continue
      map[key] ??= {}
      map[key][d] = Number(r.value_num)
      perDate[d] = (perDate[d] || 0) + 1
    }
    const dates = [...new Set(Object.values(map).flatMap(Object.keys))].sort()
    return { byKey: map, allDates: dates, sessionDates: dates.filter(d => perDate[d] >= SESSION_MIN_ITEMS) }
  }, [rows])

  // 对比表只展示最近 6 次体测，再多手机上横滑没法看
  const cols = sessionDates.slice(-6)
  const last = cols[cols.length - 1]
  const prev = cols[cols.length - 2]

  const chartDef = BODY_METRICS.find(m => m.key === chartKey) || BODY_METRICS[0]
  const chartData = useMemo(() => {
    const series = byKey[chartKey] || {}
    return Object.keys(series).sort().slice(-30).map(d => ({ x: d, y: series[d] }))
  }, [byKey, chartKey])

  const healthReviews = reviews.filter(r => r.module === 'health')
  const latestReview = healthReviews[0]
  const hasData = allDates.length > 0
  const missing = BODY_METRICS.filter(m => !byKey[m.key]).map(m => m.name)

  // 给本机 Claude 的数据摘要：把全部体成分记录按时间铺开，它才有东西可分析
  const buildSummary = () => {
    const lines = ['【体成分记录（InBody）】']
    for (const m of BODY_METRICS) {
      const series = byKey[m.key]
      if (!series) continue
      const pts = Object.keys(series).sort().map(d => `${d}: ${series[d]}${m.unit}`)
      lines.push(`${m.name}（参考 ${m.ref || '—'}）：${pts.join(' → ')}`)
    }
    if (missing.length) lines.push(`\n【尚未记录的指标】${missing.join('、')}`)
    return lines.join('\n')
  }

  const askAdvice = async () => {
    if (busy || !hasData) return
    if (isDemo) {
      showToast('演示模式没有本机 AI，配置 Supabase 后可用', 'error')
      return
    }
    setBusy(true)
    try {
      const job = await db.insert('ai_jobs', {
        kind: 'health_advice',
        input: buildSummary(),
        context: ask.trim() || '',
        source: isMobile ? 'mobile' : 'web',
      })
      showToast('已交给本机大仙分析，约 1-2 分钟')
      for (let i = 0; i < 90; i++) {
        await sleep(2000)
        const [j] = await db.list('ai_jobs', { filters: { id: job.id } })
        if (j?.status === 'done') {
          await reloadReviews()
          setAsk('')
          showToast('建议已生成')
          return
        }
        if (j?.status === 'error') {
          showToast(`分析失败：${j.error || '未知错误'}`, 'error')
          return
        }
      }
      showToast('大仙没在线（电脑要开着 npm run bot），任务已排队', 'error')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!hasData) {
    return (
      <Card>
        <EmptyState icon="🧬" text="还没有体成分记录。去「指标记录」录体脂率/体重，或把 InBody 报告发给大仙让他导进来" />
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 核心四项：体脂率 / 内脏脂肪 / 肌肉量 / 体重 */}
      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      }}>
        {BODY_METRICS.filter(m => m.core).map(m => {
          const series = byKey[m.key] || {}
          const ds = Object.keys(series).sort()
          const cur = series[ds[ds.length - 1]]
          const d = delta(cur, series[ds[ds.length - 2]], m.good)
          return (
            <div key={m.key} style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              border: `1px solid ${COLORS.border}`, minWidth: 0,
            }}>
              <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 6 }}>{m.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.primary }}>{cur == null ? '—' : cur}</span>
                <span style={{ fontSize: 12, color: COLORS.textLight }}>{m.unit}</span>
                {d && <span style={{ fontSize: 12, fontWeight: 600, color: d.color }}>{d.text}</span>}
              </div>
              {m.ref && <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>参考 {m.ref}</div>}
            </div>
          )
        })}
      </div>

      {/* 历次体测对比 */}
      <Card title={`历次体测对比（共 ${sessionDates.length} 次）`}
        extra={<span style={{ fontSize: 12, color: COLORS.textLight }}>绿=向好 · 红=变差</span>}>
        <ScrollX>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 520 }}>
            <thead>
              <tr style={{ color: COLORS.textLight, fontSize: 12, textAlign: 'left' }}>
                <th style={{ padding: 8, position: 'sticky', left: 0, background: '#fff' }}>指标</th>
                {cols.map(d => <th key={d} style={{ padding: 8, whiteSpace: 'nowrap' }}>{d.slice(5)}</th>)}
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>较上次</th>
                <th style={{ padding: 8, whiteSpace: 'nowrap' }}>参考</th>
              </tr>
            </thead>
            <tbody>
              {BODY_METRICS.map(m => {
                const series = byKey[m.key]
                const d = series ? delta(series[last], series[prev], m.good) : null
                return (
                  <tr key={m.key} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: 8, fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff' }}>
                      {m.name}
                      {!series && <span style={{ fontSize: 11, color: COLORS.orange, marginLeft: 6 }}>缺</span>}
                    </td>
                    {cols.map(c => (
                      <td key={c} style={{ padding: 8, whiteSpace: 'nowrap' }}>
                        {series?.[c] == null ? <span style={{ color: COLORS.border }}>—</span> : `${series[c]}${m.unit}`}
                      </td>
                    ))}
                    <td style={{ padding: 8, fontWeight: 600, whiteSpace: 'nowrap', color: d?.color || COLORS.textLight }}>
                      {d?.text || '—'}
                    </td>
                    <td style={{ padding: 8, fontSize: 12, color: COLORS.textLight, whiteSpace: 'nowrap' }}>{m.ref || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollX>
        {missing.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: COLORS.orange }}>
            还没记录：{missing.join('、')}——下次体测补上，对比会更完整。
          </div>
        )}
      </Card>

      {/* 单指标折线 */}
      <Card title="趋势曲线">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {BODY_METRICS.filter(m => byKey[m.key]).map(m => (
            <button key={m.key} onClick={() => setChartKey(m.key)} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 13,
              border: `1px solid ${chartKey === m.key ? COLORS.primary : COLORS.border}`,
              background: chartKey === m.key ? '#EFF6FF' : '#fff',
              color: chartKey === m.key ? COLORS.primary : COLORS.text,
            }}>{m.name}</button>
          ))}
        </div>
        <TrendChart data={chartData} unit={chartDef.unit}
          color={chartDef.good === 'up' ? COLORS.green : COLORS.primary} />
        {chartData.length < 3 && (
          <div style={{ marginTop: 8, fontSize: 12, color: COLORS.textLight }}>
            目前 {chartData.length} 个数据点，多测几次曲线才有意义。
          </div>
        )}
      </Card>

      {/* AI 建议：走本机 Claude 订阅 */}
      <Card title="🤖 大仙的健康建议"
        extra={latestReview && <span style={{ fontSize: 12, color: COLORS.textLight }}>{fmtDateTime(latestReview.created_at)}</span>}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isMobile ? 'column' : 'row' }}>
          <input value={ask} onChange={e => setAsk(e.target.value)}
            placeholder="想问什么？留空就给全面建议（饮食 / 睡眠 / 行动计划）"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, fontSize: 14, outline: 'none',
              border: `1px solid ${COLORS.border}`, boxSizing: 'border-box',
            }} />
          <button onClick={askAdvice} disabled={busy} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', whiteSpace: 'nowrap',
            background: busy ? COLORS.gray : COLORS.primary, color: '#fff', fontSize: 14, fontWeight: 600,
          }}>{busy ? '分析中…' : '让大仙分析'}</button>
        </div>
        {latestReview ? (
          <div style={{
            padding: 14, background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD',
            fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap',
          }}>{latestReview.content}</div>
        ) : (
          <EmptyState icon="💡" text="还没有建议。点上面的按钮，让本机 Claude 基于体成分数据给饮食/睡眠/行动计划" />
        )}
        {healthReviews.length > 1 && (
          <details style={{ marginTop: 10, fontSize: 13, color: COLORS.textLight }}>
            <summary style={{ cursor: 'pointer' }}>历史建议（{healthReviews.length - 1} 条）</summary>
            {healthReviews.slice(1, 6).map(r => (
              <div key={r.id} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{fmtDateTime(r.created_at)}</div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: COLORS.text }}>{r.content}</div>
              </div>
            ))}
          </details>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: COLORS.textLight }}>
          走本机 Claude Code 订阅（电脑需开着 npm run bot），不消耗 API 额度。建议仅供参考，指标异常请就医。
        </div>
      </Card>
    </div>
  )
}
