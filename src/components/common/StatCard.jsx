import { COLORS } from '../../lib/constants'

export function StatCard({ icon, label, value, sub, color = COLORS.primary, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '16px 18px',
      border: `1px solid ${COLORS.border}`, cursor: onClick ? 'pointer' : 'default',
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
    }}>
      <div style={{ fontSize: 13, color: COLORS.textLight, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textLight }}>{sub}</div>}
    </div>
  )
}

// 宽内容（表格等）横向滚动容器，避免撑破移动端布局
export function ScrollX({ children }) {
  return <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>{children}</div>
}

export function Card({ title, extra, children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`,
      padding: 18, ...style,
    }}>
      {(title || extra) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          {extra}
        </div>
      )}
      {children}
    </div>
  )
}
