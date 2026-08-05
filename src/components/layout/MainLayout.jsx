import { useState } from 'react'
import { Sidebar, NavContent } from './Sidebar'
import { PAGE_TITLES, COLORS } from '../../lib/constants'
import { useUIStore } from '../../store/useUIStore'
import { useIsMobile } from '../../hooks/useIsMobile'

function Toast() {
  const toast = useUIStore(s => s.toast)
  if (!toast) return null
  const bg = toast.type === 'error' ? COLORS.red : COLORS.green
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', padding: '10px 20px', borderRadius: 8,
      fontSize: 14, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      maxWidth: '90vw',
    }}>{toast.msg}</div>
  )
}

export function MainLayout({ children }) {
  const currentPage = useUIStore(s => s.currentPage)
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* 顶栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', background: '#111827', color: '#fff',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <button onClick={() => setDrawerOpen(true)} aria-label="打开菜单" style={{
            border: 'none', background: 'none', color: '#fff', fontSize: 22, lineHeight: 1, padding: 4,
          }}>☰</button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{PAGE_TITLES[currentPage] || '🌱 人生 OS'}</div>
        </div>

        {/* 抽屉导航 */}
        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 240, maxWidth: '75vw', height: '100%', background: '#111827',
              display: 'flex', flexDirection: 'column',
            }}>
              <NavContent onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div style={{ flex: 1, padding: 12, width: '100%' }}>
          {children}
        </div>
        <Toast />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '14px 24px', background: '#fff', borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 17, fontWeight: 600, position: 'sticky', top: 0, zIndex: 10,
        }}>
          {PAGE_TITLES[currentPage] || ''}
        </div>
        <div style={{ flex: 1, padding: 24, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
          {children}
        </div>
      </div>
      <Toast />
    </div>
  )
}
