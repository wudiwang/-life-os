import { COLORS } from '../../lib/constants'

// 轻量 SVG 折线图，无第三方依赖
// data: [{ x: '2026-07-01', y: 70.5, y2?: 110 }]
export function TrendChart({ data, color = COLORS.primary, color2 = COLORS.orange, height = 160, unit = '' }) {
  if (!data || data.length === 0) {
    return <div style={{ color: COLORS.textLight, fontSize: 13, padding: 20, textAlign: 'center' }}>暂无数据</div>
  }
  const W = 600, H = height, PAD = { l: 42, r: 12, t: 12, b: 26 }
  const ys = data.flatMap(d => [d.y, d.y2].filter(v => v != null))
  let min = Math.min(...ys), max = Math.max(...ys)
  if (min === max) { min -= 1; max += 1 }
  const span = max - min
  min -= span * 0.1; max += span * 0.1

  const px = i => PAD.l + (data.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (data.length - 1)) * (W - PAD.l - PAD.r))
  const py = v => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b)

  const line = key => data.filter(d => d[key] != null)
    .map((d) => `${px(data.indexOf(d))},${py(d[key])}`).join(' ')

  const gridLines = 4
  const labelStep = Math.max(1, Math.ceil(data.length / 6))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const v = min + ((max - min) * i) / gridLines
        const y = py(v)
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={COLORS.border} strokeWidth="1" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill={COLORS.textLight}>
              {v.toFixed(Math.abs(max - min) < 10 ? 1 : 0)}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => i % labelStep === 0 && (
        <text key={i} x={px(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={COLORS.textLight}>
          {String(d.x).slice(5)}
        </text>
      ))}
      <polyline points={line('y')} fill="none" stroke={color} strokeWidth="2" />
      {data.map((d, i) => d.y != null && <circle key={i} cx={px(i)} cy={py(d.y)} r="3" fill={color} />)}
      {data.some(d => d.y2 != null) && (
        <>
          <polyline points={line('y2')} fill="none" stroke={color2} strokeWidth="2" />
          {data.map((d, i) => d.y2 != null && <circle key={'b' + i} cx={px(i)} cy={py(d.y2)} r="3" fill={color2} />)}
        </>
      )}
      {unit && <text x={W - PAD.r} y={PAD.t + 2} textAnchor="end" fontSize="10" fill={COLORS.textLight}>{unit}</text>}
    </svg>
  )
}
