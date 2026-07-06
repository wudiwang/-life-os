export function Badge({ color = '#6B7280', children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 500, color, background: color + '1A',
      border: `1px solid ${color}33`, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}
