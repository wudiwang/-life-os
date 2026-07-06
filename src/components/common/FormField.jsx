import { COLORS } from '../../lib/constants'

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: `1px solid ${COLORS.border}`, fontSize: 14, outline: 'none',
  background: '#fff', color: COLORS.text,
}

export function FormField({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: COLORS.text }}>
        {label}{required && <span style={{ color: COLORS.red }}> *</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value ?? ''} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} style={inputStyle} />
  )
}

export function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value ?? ''} placeholder={placeholder} rows={rows}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
  )
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.key ?? o.value ?? o} value={o.key ?? o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  )
}

export function Row({ children, cols }) {
  return (
    <div style={{
      display: 'grid', gap: 12,
      gridTemplateColumns: cols || `repeat(${Array.isArray(children) ? children.length : 1}, 1fr)`,
    }}>{children}</div>
  )
}
