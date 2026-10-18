// 一周食谱：定量版健康生酮食谱（数据与营养计算在 lib/ketoPlan.js，与海报 public/keto-week.png 同源）。
import { useState } from 'react'
import { COLORS } from '../../lib/constants'
import { Card, ScrollX } from '../../components/common/StatCard'
import { useIsMobile } from '../../hooks/useIsMobile'
import { weekdayIndex } from '../../lib/date'
import {
  KETO_TARGETS, KETO_MACRO_COLORS, MEAL_SLOTS, KETO_WEEK, KETO_WEEK_AVG, KETO_PROFILE,
  KETO_EAT, KETO_TIPS, KETO_SHOPPING, itemLabel,
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
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>🥑 一周健康生酮食谱 · 定量版</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            按 {KETO_PROFILE.weightKg}kg 成年男性减脂设计 · 克数为可食部分生重 · 每天一道 🔥 空气炸锅菜
          </div>
        </div>
        <div style={{ minWidth: isMobile ? 0 : 300 }}>
          <MacroBar pct={KETO_WEEK_AVG.pct} height={22} showLabel />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.85 }}>一周平均供能比</span>
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
        <Card title="本周菜单" extra={<span style={{ fontSize: 12, color: COLORS.textLight }}>每餐右侧为 热量 / 蛋白质</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
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

      <Card title="📊 一周营养统计">
        <ScrollX>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: COLORS.textLight, textAlign: 'right' }}>
                {['', '热量 kcal', '蛋白质 g', '脂肪 g', '净碳 g', '供能比 脂/蛋/碳', '🔥 空气炸锅'].map((h, i) => (
                  <th key={h} style={{ padding: '6px 8px', fontWeight: 500, textAlign: i === 0 || i >= 5 ? 'left' : 'right', borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KETO_WEEK.map((d, i) => (
                <tr key={d.day} style={{ background: i === todayIdx ? '#EFF6FF' : undefined }}>
                  <td style={td}>{d.day}</td>
                  <td style={tdNum}>{d.total.kcal}</td>
                  <td style={tdNum}>{d.total.p}</td>
                  <td style={tdNum}>{d.total.f}</td>
                  <td style={{ ...tdNum, color: d.total.c > KETO_PROFILE.netCarbMax ? COLORS.red : COLORS.green, fontWeight: 600 }}>{d.total.c}</td>
                  <td style={td}><div style={{ width: 120 }}><MacroBar pct={d.pct} height={8} /></div><span style={{ fontSize: 11, color: COLORS.textLight }}>{d.pct.f}/{d.pct.p}/{d.pct.c}%</span></td>
                  <td style={td}>{d.air.slot} · {d.air.dish}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td style={td}>日均</td>
                <td style={tdNum}>{KETO_WEEK_AVG.kcal}</td>
                <td style={tdNum}>{KETO_WEEK_AVG.p}</td>
                <td style={tdNum}>{KETO_WEEK_AVG.f}</td>
                <td style={{ ...tdNum, color: COLORS.green }}>{KETO_WEEK_AVG.c}</td>
                <td style={td}>{KETO_WEEK_AVG.pct.f}/{KETO_WEEK_AVG.pct.p}/{KETO_WEEK_AVG.pct.c}%</td>
                <td style={td}>一周合计 {KETO_WEEK_AVG.week.kcal} kcal</td>
              </tr>
            </tbody>
          </table>
        </ScrollX>
      </Card>

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

      <Card title="🛒 一周采购清单（按食谱克数汇总，可食部分）">
        {KETO_SHOPPING.map(s => (
          <div key={s.group} style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 6 }}>
            <b style={{ color: COLORS.primary, marginRight: 8 }}>{s.group}</b>{s.items}
          </div>
        ))}
      </Card>

      <div style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
        营养按常见食物成分表计算，调味料未计；非医疗建议，有慢病或在服药请先咨询医生。
      </div>
    </div>
  )
}

const td = { padding: '7px 8px', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' }
const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function MacroBar({ pct, height, showLabel }) {
  const parts = [['f', '脂肪'], ['p', '蛋白'], ['c', '碳水']]
  return (
    <div style={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden' }}>
      {parts.map(([k, label]) => (
        <div key={k} style={{
          width: `${pct[k]}%`, background: KETO_MACRO_COLORS[k], color: '#fff', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden',
        }}>{showLabel && (pct[k] >= 15 ? `${label} ${pct[k]}%` : `${pct[k]}%`)}</div>
      ))}
    </div>
  )
}

function DayMenu({ d, isToday }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{d.day}</span>
          {isToday && <span style={{ fontSize: 11, color: '#fff', background: COLORS.primary, borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>今天</span>}
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{d.theme}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: COLORS.textLight, lineHeight: 1.5 }}>
          <div><b style={{ color: COLORS.text, fontSize: 14 }}>{d.total.kcal}</b> kcal</div>
          <div>蛋白 {d.total.p}g · 脂 {d.total.f}g · <b style={{ color: COLORS.green }}>净碳 {d.total.c}g</b></div>
        </div>
      </div>
      {MEAL_SLOTS.map(s => {
        const m = d[s.key]
        return (
          <div key={s.key} style={{ padding: '7px 0', borderTop: `1px dashed ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: COLORS.primaryDark, marginRight: 6 }}>{s.icon} {s.label}</span>{m.name}
              </span>
              {m.items.length > 0 && <span style={{ fontSize: 12, color: COLORS.textLight, whiteSpace: 'nowrap' }}>{m.total.kcal} / {m.total.p}g</span>}
            </div>
            {m.items.length > 0 && (
              <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 3, lineHeight: 1.6 }}>{m.items.map(itemLabel).join(' · ')}</div>
            )}
            {m.air && (
              <div style={{ fontSize: 12, marginTop: 5, padding: '6px 8px', borderRadius: 6, background: '#FFF7ED', color: '#9A3412', lineHeight: 1.6 }}>
                🔥 空气炸锅 · {m.air.dish}：{m.air.how}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
