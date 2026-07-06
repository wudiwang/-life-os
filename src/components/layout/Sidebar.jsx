import { NAV_ITEMS, COLORS } from '../../lib/constants'
import { useUIStore } from '../../store/useUIStore'
import { isDemo } from '../../lib/dataStore'

export function Sidebar() {
  const { currentPage, setPage } = useUIStore()
  return (
    <div style={{
      width: 200, minWidth: 200, background: '#111827', color: '#D1D5DB',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #1F2937' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>🌱 人生 OS</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
          记录自己 · 看清自己 · 过好一生
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {NAV_ITEMS.map(item => {
          const active = currentPage === item.key
          return (
            <div
              key={item.key}
              onClick={() => setPage(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                cursor: 'pointer', fontSize: 14,
                background: active ? COLORS.primary : 'transparent',
                color: active ? '#fff' : '#D1D5DB',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1F2937', fontSize: 11, color: '#6B7280' }}>
        {isDemo ? '🟡 演示模式（数据存本机）' : '🟢 已连接 Supabase'}
      </div>
    </div>
  )
}
