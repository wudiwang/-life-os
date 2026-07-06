import { COLORS } from '../../lib/constants'

export function EmptyState({ icon = '📭', text = '暂无数据', action }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: COLORS.textLight }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, marginBottom: action ? 14 : 0 }}>{text}</div>
      {action}
    </div>
  )
}

export function AddButton({ onClick, children = '+ 新增' }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 8, border: 'none',
      background: COLORS.primary, color: '#fff', fontSize: 14, fontWeight: 500,
    }}>{children}</button>
  )
}

export function IconBtn({ onClick, title, children, color = COLORS.gray }) {
  return (
    <button onClick={onClick} title={title} style={{
      border: 'none', background: 'none', color, fontSize: 14, padding: '2px 6px',
    }}>{children}</button>
  )
}
