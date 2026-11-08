// 食谱：生酮塑形的一日基线 / 一周食谱 / 蛋白替换 / 问答（脂肪、蛋白、电解质、喝水）。
// 数据和计算都在 shapeRecipe.js（npm run test:shape 校验每天达标），这页只负责呈现，PC 与手机共用一套布局。
import { useState } from 'react'
import { COLORS } from '../../lib/constants'
import { Card } from '../../components/common/StatCard'
import { useIsMobile } from '../../hooks/useIsMobile'
import { bangkokDay } from '../../lib/dailyActions'
import { RECIPE_FOODS, RECIPE_TARGETS, WEEK, BASELINE_DAY, PROTEIN_SWAPS, PROTEIN_UNIT, QA, sumItems, dayTotals, dayChecks, eggCount, amountLabel, shoppingList } from './shapeRecipe'
import { RECIPE_CREDITS, HAS_IMG } from './recipeCredits'
import { FoodImg } from './FoodImg'
import { imageName } from './mealImages'

const subtle = { fontSize: 12, color: COLORS.textLight, lineHeight: 1.6 }
const fmt = n => Number(n).toLocaleString('zh-CN')
const TABS = [
  { key: 'base', label: '一日基线' },
  { key: 'week', label: '一周食谱' },
  { key: 'swap', label: '蛋白替换' },
  { key: 'qa', label: '问答' },
]
const TAG_COLOR = { 精瘦: COLORS.green, 中等: COLORS.orange, 高脂: COLORS.red }
const SLOT_ICON = { breakfast: '🌅', lunch: '☀️', snack: '🥜', dinner: '🌙' }

export function RecipePage() {
  const mobile = useIsMobile()
  const [tab, setTab] = useState('base')
  const todayIdx = (new Date(`${bangkokDay()}T00:00:00Z`).getUTCDay() + 6) % 7 // 周一=0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 960 }}>
      <div>
        <div style={{ fontSize: mobile ? 20 : 22, fontWeight: 700 }}>🥗 食谱 · 生酮基线</div>
        <div style={subtle}>围绕一个固定基线吃：每天结构不变，只换蛋白和蔬菜。每一天的数字都按营养表算过，全部达标。</div>
      </div>

      <TargetBar mobile={mobile} />

      <div style={{ display: 'flex', gap: 6, background: COLORS.bg, padding: 4, borderRadius: 10 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, minHeight: 36, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
            background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? COLORS.primaryDark : COLORS.textLight,
            fontWeight: tab === t.key ? 600 : 400, boxShadow: tab === t.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'base' && <BaseTab mobile={mobile} />}
      {tab === 'week' && <WeekTab mobile={mobile} todayIdx={todayIdx} />}
      {tab === 'swap' && <SwapTab mobile={mobile} />}
      {tab === 'qa' && <QATab />}
    </div>
  )
}

function TargetBar({ mobile }) {
  const T = RECIPE_TARGETS
  const items = [
    ['热量', '约 1,800', 'kcal'],
    ['蛋白', `≥ ${T.protein}`, 'g'],
    ['净碳水', `≤ ${T.netCarb}`, 'g'],
    ['脂肪（上限）', `≤ ${T.fat}`, 'g'],
    ['饱和脂肪', `≤ ${T.satFat}`, 'g'],
    ['喝水', '3–3.5', 'L'],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 8 }}>
      {items.map(([label, v, unit]) => (
        <div key={label} style={{ background: '#EFF6FF', borderRadius: 10, padding: '8px 10px' }}>
          <div style={subtle}>{label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.primaryDark }}>{v}<span style={{ fontSize: 12, fontWeight: 400 }}> {unit}</span></div>
        </div>
      ))}
    </div>
  )
}

// ── 一日基线 ──
function BaseTab({ mobile }) {
  return (
    <>
      <Card title="📌 每天的基线（周一就是这一天）">
        <div style={{ ...subtle, marginBottom: 10 }}>早餐固定「3 个蛋 + 1 袋 CP + 一份绿叶菜 + 半个牛油果」；午餐 3 份蛋白；晚餐一份鱼或肉；下午一小把坚果。其他日子按这个结构换。</div>
        <DayView day={BASELINE_DAY} mobile={mobile} />
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        <SourceCard title="🥩 蛋白从哪来" field="p" day={BASELINE_DAY} color={COLORS.primary} />
        <SourceCard title="🫒 脂肪从哪来" field="f" day={BASELINE_DAY} color={COLORS.orange} />
      </div>
    </>
  )
}

function SourceCard({ title, field, day, color }) {
  const by = new Map()
  for (const m of day.meals) for (const [k, g] of m.items) by.set(k, (by.get(k) || 0) + g)
  const rows = [...by.entries()].map(([k, g]) => ({ k, g, v: sumItems([[k, g]])[field] })).filter(r => r.v >= 1).sort((a, b) => b.v - a.v)
  const total = dayTotals(day)[field]
  return (
    <Card title={title} extra={<span style={subtle}>合计 {total}g</span>}>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
          <span style={{ width: 92, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{RECIPE_FOODS[r.k].name}</span>
          <div style={{ flex: 1, height: 8, background: COLORS.bg, borderRadius: 4, minWidth: 0 }}>
            <div style={{ width: `${(r.v / total) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
          <span style={{ width: 44, textAlign: 'right', fontWeight: 600 }}>{Math.round(r.v)}g</span>
        </div>
      ))}
    </Card>
  )
}

// ── 一周食谱 ──
function WeekTab({ mobile, todayIdx }) {
  const [picked, setPicked] = useState(todayIdx)
  const day = WEEK[picked]
  const list = shoppingList(WEEK)
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(4, 1fr)' : 'repeat(7, 1fr)', gap: 6 }}>
        {WEEK.map((d, i) => {
          const s = dayTotals(d), on = i === picked
          return (
            <button key={d.day} onClick={() => setPicked(i)} style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', minWidth: 0,
              border: `1px solid ${on ? COLORS.primary : COLORS.border}`, background: on ? '#EFF6FF' : '#fff',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: on ? COLORS.primaryDark : COLORS.text }}>{d.day}{i === todayIdx ? ' · 今天' : ''}</div>
              <div style={{ ...subtle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.theme}</div>
              <div style={{ fontSize: 11, color: COLORS.textLight }}>{fmt(s.kcal)} · 蛋白 {Math.round(s.p)}</div>
            </button>
          )
        })}
      </div>
      <Card title={`${day.day} · ${day.theme}`}>
        <DayView day={day} mobile={mobile} />
      </Card>
      <Card title="🛒 一周采购清单" extra={<span style={subtle}>按上面 7 天加总</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '8px 12px' }}>
          {list.map(x => (
            <div key={x.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <FoodImg k={x.key} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{RECIPE_FOODS[x.key].name}</div>
                <div style={subtle}>{x.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...subtle, marginTop: 10 }}>肉、鱼、蔬菜是可食部分生重，买的时候按带骨带皮多买 10–30%；牛油果按每个约 140g 果肉（中等 Hass）。CP 鸡胸一周 {list.find(x => x.key === 'cp')?.label}，可以分两次买。</div>
      </Card>
    </>
  )
}

// 一天：合计（对目标打勾）+ 每顿饭（图、重量、蛋白、热量、做法）
function DayView({ day, mobile }) {
  const s = dayTotals(day), c = dayChecks(day), eggs = eggCount(day), T = RECIPE_TARGETS
  const facts = [
    ['热量', `${fmt(s.kcal)}`, 'kcal', c.kcal],
    ['蛋白', `${Math.round(s.p)}`, `/ ≥${T.protein}g`, c.protein],
    ['净碳', `${s.c}`, `/ ≤${T.netCarb}g`, c.netCarb],
    ['脂肪', `${Math.round(s.f)}`, `/ ≤${T.fat}g`, c.fat],
    ['饱和脂肪', `${s.sfa}`, `/ ≤${T.satFat}g`, c.satFat],
    ['全蛋', `${eggs}`, `/ ≤${T.eggsMax} 个`, c.eggs],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 6 }}>
        {facts.map(([label, v, unit, ok]) => (
          <div key={label} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '6px 8px' }}>
            <div style={{ ...subtle, display: 'flex', justifyContent: 'space-between' }}>{label}<span style={{ color: ok ? COLORS.green : COLORS.red }}>{ok ? '✓' : '✗'}</span></div>
            <div style={{ fontWeight: 700 }}>{v}<span style={{ fontSize: 11, fontWeight: 400, color: COLORS.textLight }}> {unit}</span></div>
          </div>
        ))}
      </div>
      {day.meals.map(m => <MealBlock key={m.slot} meal={m} mobile={mobile} />)}
    </div>
  )
}

function MealBlock({ meal, mobile }) {
  const s = sumItems(meal.items)
  return (
    <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 10px' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{SLOT_ICON[meal.slot]} {meal.time} · {meal.name}</div>
        <div style={{ fontSize: 12, color: COLORS.text }}>{fmt(s.kcal)} kcal · <b>蛋白 {Math.round(s.p)}g</b> · 脂肪 {Math.round(s.f)}g · 净碳 {s.c}g</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '6px 16px', margin: '8px 0' }}>
        {meal.items.map(([k, g]) => {
          const n = sumItems([[k, g]])
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <FoodImg k={k} size={48} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{RECIPE_FOODS[k].name} <span style={{ fontWeight: 400, color: COLORS.text }}>{amountLabel(k, g)}</span></div>
                <div style={subtle}>{n.kcal} kcal · 蛋白 {n.p}g · 脂肪 {n.f}g{n.c >= 1 ? ` · 净碳 ${n.c}g` : ''}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, background: COLORS.bg, borderRadius: 8, padding: '8px 10px' }}><b>做法</b>：{meal.how}</div>
    </div>
  )
}

// ── 蛋白替换 ──
function SwapTab({ mobile }) {
  return (
    <>
      <Card title={`🔁 1 份蛋白 = ${PROTEIN_UNIT}g = 1 袋 CP`}>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div>每天 ≥ 150g 蛋白 ≈ <b>8–9 份</b>。下面每一格都是 1 份，可以按份等量互换。</div>
          <div>换成<b style={{ color: COLORS.red }}>高脂</b>蛋白（鸡蛋、青花鱼、三文鱼）时，同一餐少放 10g 油；换成<b style={{ color: COLORS.green }}>精瘦</b>蛋白可以多放 5–10g。</div>
          <div style={subtle}>只吃 CP 要 8–9 袋（钠 2.8g，不建议，一天 ≤ 4 袋）；只吃鸡蛋要 24 个（不现实，全蛋每天 ≤ 3 个，想多吃加蛋清）。</div>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
        {PROTEIN_SWAPS.map(s => {
          const n = sumItems([[s.key, s.g]])
          return (
            <div key={s.key} style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ position: 'relative' }}>
                {HAS_IMG.has(s.key)
                  ? <img src={`/recipe/${s.key}.jpg`} alt={RECIPE_FOODS[s.key].name} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: COLORS.bg }} />
                  : <div style={{ aspectRatio: '4 / 3', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: COLORS.textLight }}>{RECIPE_FOODS[s.key].name.slice(0, 1)}</div>}
                <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 11, color: '#fff', background: TAG_COLOR[s.tag], borderRadius: 6, padding: '1px 6px' }}>{s.tag}</span>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{RECIPE_FOODS[s.key].name}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.primaryDark }}>{amountLabel(s.key, s.g)}</div>
                <div style={subtle}>{n.kcal} kcal · 脂肪 {n.f}g · 饱和 {n.sfa}g{n.c >= 1 ? ` · 净碳 ${n.c}g` : ''}</div>
                {s.tip && <div style={{ ...subtle, color: COLORS.text }}>{s.tip}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── 问答 ──
function QATab() {
  const credits = RECIPE_CREDITS.filter(c => c.sourceUrl)
  return (
    <>
      {QA.map(g => (
        <Card key={g.group} title={g.group}>
          {g.items.map((it, i) => (
            <details key={it.q} open style={{ borderTop: i ? `1px solid ${COLORS.border}` : 'none', padding: '8px 0' }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{it.q}</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                {it.a.map(line => <li key={line}>{line}</li>)}
              </ul>
            </details>
          ))}
        </Card>
      ))}
      <details style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '10px 16px' }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: COLORS.textLight }}>图片来源</summary>
        <div style={{ ...subtle, marginTop: 6 }}>
          CP 包装为用户提供的照片；其余来自 Wikimedia Commons：
          {credits.map(c => (
            <div key={c.key}>{imageName(c.key)}：<a href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primaryDark }}>{c.title}</a>，{c.author}，{c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primaryDark }}>{c.license}</a> : c.license}</div>
          ))}
        </div>
      </details>
    </>
  )
}
