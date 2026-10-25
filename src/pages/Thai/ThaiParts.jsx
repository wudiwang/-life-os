import { COLORS } from '../../lib/constants'

export const ui = {
  button: { minHeight: 44, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: '10px 16px', color: COLORS.text, background: '#fff', cursor: 'pointer', fontSize: 14 },
  primary: { minHeight: 44, borderRadius: 10, border: `1px solid ${COLORS.primaryDark}`, padding: '10px 18px', color: '#fff', background: COLORS.primaryDark, cursor: 'pointer', fontSize: 15, fontWeight: 600 },
  subtle: { color: COLORS.textLight, fontSize: 13, lineHeight: 1.7 },
  card: { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 14 },
  h2: { fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
}

const ROMAN = '#1D4ED8'

// 逐词对齐：上面是读音，下面是这个读音对应的中文。
export function TokenLine({ tokens, hideZh = false, size = 'md', blank = -1 }) {
  const big = size === 'lg'
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: big ? '8px 6px' : '6px 5px', alignItems: 'flex-start' }}>
    {tokens.map((t, i) => {
      const isBlank = i === blank
      return <span key={i} style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 28,
        padding: big ? '5px 9px' : '3px 7px', borderRadius: 8,
        background: isBlank ? '#FEF3C7' : t.fn ? 'transparent' : '#EFF6FF',
        border: `1px ${isBlank ? 'dashed #F59E0B' : t.fn ? `dashed ${COLORS.border}` : 'solid #DBEAFE'}`,
      }}>
        <span style={{ fontSize: big ? 19 : 16, fontWeight: 600, color: t.fn ? COLORS.textLight : ROMAN, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
          {isBlank ? '？' : t.roman}
        </span>
        {!hideZh && <span style={{ fontSize: big ? 13 : 12, color: COLORS.textLight, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
          {isBlank ? '' : t.zh}
        </span>}
      </span>
    })}
  </div>
}

export function AudioButton({ id, audio, player, label = '播放', size = 44 }) {
  const active = audio.id === id && ['loading', 'playing'].includes(audio.status)
  return <button type="button" aria-label={`${active ? '停止' : label}`} aria-pressed={active}
    onClick={() => player.current?.play(id)}
    style={{ ...ui.button, padding: 0, width: size, height: size, minHeight: size, flexShrink: 0, color: COLORS.primaryDark,
      background: active ? '#DBEAFE' : '#EFF6FF', borderColor: '#BFDBFE', fontSize: size > 44 ? 24 : 19 }}>
    <span aria-hidden="true">{active ? '■' : '🔊'}</span>
  </button>
}

export function MasteryToggle({ mastered, weak, onToggle, disabled }) {
  const label = mastered ? '✓ 已掌握' : weak ? '待巩固' : '标记掌握'
  const tone = mastered
    ? { color: '#047857', background: '#D1FAE5', borderColor: '#6EE7B7' }
    : weak ? { color: '#B45309', background: '#FEF3C7', borderColor: '#FCD34D' }
      : { color: COLORS.textLight, background: '#fff', borderColor: COLORS.border }
  return <button type="button" aria-pressed={mastered} disabled={disabled} onClick={onToggle}
    title={weak && !mastered ? '上次答错了，再巩固一下' : undefined}
    style={{ ...ui.button, ...tone, minHeight: 36, padding: '6px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', opacity: disabled ? 0.6 : 1 }}>
    {label}
  </button>
}

export function ProgressBar({ pct, color = COLORS.green, height = 8 }) {
  return <div style={{ height, background: '#E5E7EB', borderRadius: height, overflow: 'hidden' }}>
    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: height, transition: 'width .3s' }} />
  </div>
}

export function ProgressRing({ pct, size = 96, stroke = 10, color = COLORS.green, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .4s' }} />
    </svg>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  </div>
}

// 场景插画：大号表情拼出画面，配一句情境，让词句挂在具体场景上记。
export function SceneCard({ scene, mobile, children }) {
  const [a, b, c] = scene.emoji
  const big = mobile ? 54 : 64
  return <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${COLORS.border}`, background: `linear-gradient(135deg, ${scene.tint} 0%, #fff 85%)` }}>
    <div role="img" aria-label={`场景：${scene.place}`} style={{ position: 'relative', height: mobile ? 120 : 140 }}>
      <span style={{ position: 'absolute', left: '12%', top: 22, fontSize: big }}>{a}</span>
      <span style={{ position: 'absolute', left: '44%', top: 8, fontSize: big * 0.8, transform: 'rotate(-8deg)' }}>{b}</span>
      {c && <span style={{ position: 'absolute', right: '12%', top: 30, fontSize: big * 0.9 }}>{c}</span>}
      <span style={{ position: 'absolute', left: 14, bottom: 10, fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,.85)', color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
        📍 {scene.place}
      </span>
    </div>
    <div style={{ padding: mobile ? '12px 16px 16px' : '14px 22px 20px' }}>
      <p style={{ ...ui.subtle, margin: '0 0 6px', fontSize: 14 }}>{scene.story}</p>
      {children}
    </div>
  </div>
}

export function Chip({ active, onClick, children }) {
  return <button type="button" aria-pressed={active} onClick={onClick}
    style={{ ...ui.button, minHeight: 36, padding: '6px 12px', fontSize: 13, borderRadius: 20,
      background: active ? '#DBEAFE' : '#fff', borderColor: active ? '#93C5FD' : COLORS.border, color: active ? COLORS.primaryDark : COLORS.text, fontWeight: active ? 600 : 400 }}>
    {children}
  </button>
}
