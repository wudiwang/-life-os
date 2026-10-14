// 一周食谱：静态健康生酮食谱（数据在 lib/ketoPlan.js，与海报 public/keto-week.png 同源）。
import { useState } from 'react'
import { COLORS } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { useIsMobile } from '../../hooks/useIsMobile'
import { weekdayIndex } from '../../lib/date'
import {
  KETO_TARGETS, KETO_MACROS, MEAL_SLOTS, KETO_WEEK, KETO_EAT, KETO_TIPS, KETO_SHOPPING,
} from '../../lib/ketoPlan'

const POSTER = '/keto-week.png'

export function MealPlanPage() {
  const isMobile = useIsMobile()
  const todayIdx = weekdayIndex() - 1
  const [picked, setPicked] = useState(todayIdx)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'linear-gradient(135deg, #1E3A8A, #3B82F6)', color: '#fff',
        borderRadius: 12, padding: isMobile ? 16 : '20px 24px',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14,
        justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center',
      }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>🥑 一周健康生酮食谱</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            低碳水 · 适量蛋白 · 优质脂肪 · 蔬菜吃够 · 电解质补足
          </div>
        </div>
        <div style={{ minWidth: isMobile ? 0 : 300 }}>
          <div style={{ display: 'flex', height: 22, borderRadius: 11, overflow: 'hidden' }}>
            {KETO_MACROS.map(m => (
              <div key={m.label} style={{
                width: `${m.pct}%`, background: m.color, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{m.pct >= 15 ? `${m.label} ${m.pct}%` : `${m.pct}%`}</div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.85 }}>供能比参考</span>
            <a href={POSTER} target="_blank" rel="noreferrer" download="一周生酮食谱.png" style={{
              fontSize: 13, color: '#1E3A8A', background: '#fff', borderRadius: 6,
              padding: '4px 10px', textDecoration: 'none', fontWeight: 600,
            }}>🖼️ 查看大图</a>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 10 }}>
        {KETO_TARGETS.map((t, i) => (
          <div key={t.label} style={{ gridColumn: isMobile && i === KETO_TARGETS.length - 1 ? 'span 2' : undefined, background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: COLORS.textLight }}>{t.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.primaryDark, margin: '4px 0' }}>{t.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, lineHeight: 1.5 }}>{t.note}</div>
          </div>
        ))}
      </div>

      {isMobile ? (
        <Card title="每日菜单">
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
            {KETO_WEEK.map((d, i) => (
              <button key={d.day} onClick={() => setPicked(i)} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 16, fontSize: 13,
                border: `1px solid ${i === picked ? COLORS.primary : COLORS.border}`,
                background: i === picked ? COLORS.primary : '#fff',
                color: i === picked ? '#fff' : COLORS.text,
              }}>{d.day}{i === todayIdx ? ' · 今' : ''}</button>
            ))}
          </div>
          <DayMenu d={KETO_WEEK[picked]} isToday={picked === todayIdx} />
        </Card>
      ) : (
        <Card title="本周菜单" extra={<span style={{ fontSize: 12, color: COLORS.textLight }}>净碳为家常份量估算值</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {KETO_WEEK.map((d, i) => (
              <div key={d.day} style={{
                borderRadius: 10, padding: 14,
                border: `${i === todayIdx ? 2 : 1}px solid ${i === todayIdx ? COLORS.primary : COLORS.border}`,
                background: i === todayIdx ? '#EFF6FF' : '#fff',
              }}>
                <DayMenu d={d} isToday={i === todayIdx} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
        {KETO_EAT.map(g => (
          <Card key={g.title} style={{ borderTop: `4px solid ${g.color}` }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: g.color, marginBottom: 8 }}>{g.title}</div>
            {g.items.map(it => <div key={it} style={{ fontSize: 13, lineHeight: 1.9 }}>· {it}</div>)}
          </Card>
        ))}
      </div>

      <Card title="执行要点">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          {KETO_TIPS.map(t => (
            <div key={t.title}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.primaryDark, marginBottom: 4 }}>{t.title}</div>
              <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>{t.text}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="🛒 一周采购清单（1 人份）">
        {KETO_SHOPPING.map(s => (
          <div key={s.group} style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 6 }}>
            <b style={{ color: COLORS.primary, marginRight: 8 }}>{s.group}</b>{s.items}
          </div>
        ))}
      </Card>

      <div style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
        份量与净碳为估算值，非医疗建议；有慢病或在服药请先咨询医生。
      </div>
    </div>
  )
}

function DayMenu({ d, isToday }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{d.day}</span>
          {isToday && <span style={{ fontSize: 11, color: '#fff', background: COLORS.primary, borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>今天</span>}
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{d.theme}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.green, whiteSpace: 'nowrap' }}>净碳 ≈ {d.carbs}g</span>
      </div>
      {MEAL_SLOTS.map(s => (
        <div key={s.key} style={{ display: 'flex', gap: 8, padding: '6px 0', borderTop: `1px dashed ${COLORS.border}` }}>
          <span style={{ fontSize: 12, color: COLORS.primaryDark, fontWeight: 600, flexShrink: 0, width: 52 }}>{s.icon} {s.label}</span>
          <span style={{ fontSize: 13, lineHeight: 1.6 }}>{d[s.key]}</span>
        </div>
      ))}
    </>
  )
}
