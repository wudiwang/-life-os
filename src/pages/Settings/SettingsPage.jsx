import { useState } from 'react'
import { COLORS, ALL_TABLES } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { db, isDemo } from '../../lib/dataStore'
import { hasSupabase } from '../../lib/supabase'
import { useUIStore } from '../../store/useUIStore'
import { todayStr } from '../../lib/date'

export function SettingsPage() {
  const showToast = useUIStore(s => s.showToast)
  const [exporting, setExporting] = useState(false)

  const exportAll = async () => {
    setExporting(true)
    try {
      const data = await db.exportAll(ALL_TABLES)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `人生OS备份_${todayStr()}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('备份已导出')
    } catch (e) {
      showToast(`导出失败：${e.message}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <Card title="连接状态">
        <StatusRow label="数据库（Supabase）" ok={hasSupabase}
          okText="已连接，数据云端永久保存"
          badText="演示模式：数据仅存在本浏览器 localStorage。填好 .env 中的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 并重新部署即可切换" />
        <StatusRow label="AI 分析（Claude API）" ok={null}
          okText=""
          badText="服务端能力：部署到 Vercel 并配置 CLAUDE_API_KEY 环境变量后，AI 分析页面即可使用" />
      </Card>

      <Card title="数据备份">
        <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 12 }}>
          导出全部模块数据为 JSON 文件（{ALL_TABLES.length} 张表）。建议定期备份。
        </div>
        <button onClick={exportAll} disabled={exporting} style={{
          padding: '9px 20px', borderRadius: 8, border: 'none',
          background: COLORS.primary, color: '#fff', fontSize: 14,
        }}>{exporting ? '导出中…' : '📦 导出全部数据'}</button>
      </Card>

      {isDemo && (
        <Card title="演示数据">
          <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 12 }}>
            清空本浏览器中的所有演示数据（不可恢复，建议先导出备份）。
          </div>
          <button onClick={() => {
            if (window.confirm('确定清空本机全部演示数据？此操作不可恢复。')) {
              db.clearDemoData()
              showToast('已清空，刷新页面生效')
              setTimeout(() => window.location.reload(), 800)
            }
          }} style={{
            padding: '9px 20px', borderRadius: 8, border: `1px solid ${COLORS.red}`,
            background: '#fff', color: COLORS.red, fontSize: 14,
          }}>🗑️ 清空演示数据</button>
        </Card>
      )}

      <Card title="关于">
        <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.8 }}>
          🌱 人生 OS · 个人管理系统 v1.0<br />
          记录生活 · 记录感悟 · 记录目标 · 记录健康——用数字化的方式看清自己，过好这一生。<br />
          架构：React 19 + Vite + Supabase + Vercel Serverless + Claude API（同领航项目）。<br />
          文档：README.md / 部署指南.md / docs/实施纲领.md
        </div>
      </Card>
    </div>
  )
}

function StatusRow({ label, ok, okText, badText }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', fontSize: 14, alignItems: 'flex-start' }}>
      <span style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{label}</span>
      {ok === true && <span style={{ color: COLORS.green, fontSize: 13 }}>🟢 {okText}</span>}
      {ok === false && <span style={{ color: COLORS.orange, fontSize: 13 }}>🟡 {badText}</span>}
      {ok === null && <span style={{ color: COLORS.textLight, fontSize: 13 }}>{badText}</span>}
    </div>
  )
}
