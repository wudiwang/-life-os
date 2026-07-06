import { COLORS } from '../../lib/constants'

export function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: '100%', maxWidth: width,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: 20, color: COLORS.gray, lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

export function ModalActions({ onCancel, onSubmit, submitText = '保存', danger = false, disabled = false }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
      {onCancel && (
        <button onClick={onCancel} style={{
          padding: '8px 18px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
          background: '#fff', color: COLORS.text, fontSize: 14,
        }}>取消</button>
      )}
      <button onClick={onSubmit} disabled={disabled} style={{
        padding: '8px 18px', borderRadius: 8, border: 'none',
        background: disabled ? COLORS.border : (danger ? COLORS.red : COLORS.primary),
        color: '#fff', fontSize: 14, fontWeight: 500,
      }}>{submitText}</button>
    </div>
  )
}
