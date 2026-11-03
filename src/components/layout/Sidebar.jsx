import { useState } from 'react'
import { NAV_ITEMS, PRIMARY_NAV, COLORS } from '../../lib/constants'
import { useUIStore } from '../../store/useUIStore'
import { isDemo } from '../../lib/dataStore'

const FOLD_KEY = 'life-os-nav-more-open'
const readOpen = () => { try { return localStorage.getItem(FOLD_KEY) === '1' } catch { return false } }
const saveOpen = v => { try { localStorage.setItem(FOLD_KEY, v ? '1' : '0') } catch { /* 无痕模式等：只是不记住 */ } }

// 导航内容：桌面侧栏与移动端抽屉共用
export function NavContent({ onNavigate }) {
  const { currentPage, setPage } = useUIStore()
  const primary = NAV_ITEMS.filter(i => PRIMARY_NAV.includes(i.key))
  const folded = NAV_ITEMS.filter(i => !PRIMARY_NAV.includes(i.key))
  // 打开时正在看折叠里的模块就先展开，免得找不到自己在哪；之后完全由按钮控制
  const [showMore, setShowMore] = useState(() => readOpen() || folded.some(i => i.key === currentPage))
  const item = it => {
    const active = currentPage === it.key
    return (
      <div
        key={it.key}
        onClick={() => { setPage(it.key); onNavigate?.() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 8, marginBottom: 2,
          cursor: 'pointer', fontSize: 14,
          background: active ? COLORS.primary : 'transparent',
          color: active ? '#fff' : '#D1D5DB',
          fontWeight: active ? 600 : 400,
        }}
      >
        <span>{it.icon}</span>
        <span>{it.label}</span>
      </div>
    )
  }
  return (
    <>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #1F2937' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>🌱 人生 OS</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
          记录自己 · 看清自己 · 过好一生
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {primary.map(item)}
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => { const v = !showMore; setShowMore(v); saveOpen(v) }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
            padding: '8px 12px', border: 'none', borderTop: '1px solid #1F2937', background: 'transparent',
            color: '#9CA3AF', fontSize: 12, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ display: 'inline-block', transform: showMore ? 'rotate(90deg)' : 'none' }}>›</span>
          更多模块 · {folded.length}{showMore ? '' : '（已折叠）'}
        </button>
        {showMore && <div style={{ opacity: 0.85 }}>{folded.map(item)}</div>}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1F2937', fontSize: 11, color: '#6B7280' }}>
        {isDemo ? '🟡 演示模式（数据存本机）' : '🟢 已连接 Supabase'}
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <div style={{
      width: 200, minWidth: 200, background: '#111827', color: '#D1D5DB',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
    }}>
      <NavContent />
    </div>
  )
}
