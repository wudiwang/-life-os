import { Sidebar } from './Sidebar'
import { PAGE_TITLES, COLORS } from '../../lib/constants'
import { useUIStore } from '../../store/useUIStore'

function Toast() {
  const toast = useUIStore(s => s.toast)
  if (!toast) return null
  const bg = toast.type === 'error' ? COLORS.red : COLORS.green
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', padding: '10px 20px', borderRadius: 8,
      fontSize: 14, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>{toast.msg}</div>
  )
}

export function MainLayout({ children }) {
  const currentPage = useUIStore(s => s.currentPage)
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
