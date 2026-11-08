// 健康塑形（网站首页）：只做呈现。录入不在这里——聊天入口的 AI 按
// docs/塑形数据录入总则.md 写 shape_food_logs / shape_workouts / shape_daily。
// 版式原则：少字。顶部只有蛋白、热量两个大数字 + 要不要补、补什么；每一顿一张图卡（图 + 热量 + 蛋白）；
// 教练点评、能量缺口、计划要点都收进最下面的「更多」。补什么的算法在 shapeSuggest.js，配图在 mealImages.js。
import { useState } from 'react'
import { COLORS } from '../../lib/constants'
import { Card, ScrollX } from '../../components/common/StatCard'
import { TrendChart } from '../../components/common/TrendChart'
import { TableMissing } from '../../components/common/TableMissing'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { bangkokDay } from '../../lib/dailyActions'
import { useUIStore } from '../../store/useUIStore'
import { SHAPE_PLAN, WORKOUT_KINDS } from './shapePlan'
import { addDays, sumFood, weightOn, energyBalance, weekSummary, weightTrend, planDay } from './shapeCalc'
import { suggest, cpBagsEaten, LIMITS } from './shapeSuggest'
import { mealCards } from './mealImages'
import { FoodImg } from './FoodImg'

const subtle = { fontSize: 12, color: COLORS.textLight, lineHeight: 1.6 }
const fmt = n => (n == null ? '—' : Math.round(Number(n)).toLocaleString('zh-CN'))
const r1 = v => Math.round(v * 10) / 10
const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日']
const STATUS = {
  true: { icon: '✓', color: COLORS.green },
  false: { icon: '✗', color: COLORS.red },
  null: { icon: '·', color: COLORS.textLight },
}
const TONE = { short: COLORS.orange, ok: COLORS.green, over: COLORS.red }

export function ShapePage() {
  const mobile = useIsMobile()
  const setPage = useUIStore(s => s.setPage)
  const today = bangkokDay()
  const [day, setDay] = useState(today)
  const opts = { optional: true, orderBy: 'log_date', ascending: false, limit: 1000 }
  const foodT = useTable('shape_food_logs', opts)
  const workT = useTable('shape_workouts', opts)
  const dailyT = useTable('shape_daily', opts)
  const missing = foodT.missing || workT.missing || dailyT.missing

  const food = foodT.rows.filter(r => r.log_date === day)
  const workouts = workT.rows.filter(r => r.log_date === day)
  const daily = dailyT.rows.find(r => r.log_date === day) || null
  const totals = sumFood(food)
  const energy = energyBalance({ food, workouts, daily, weightKg: weightOn(dailyT.rows, day) })
  const week = weekSummary({ day, foodRows: foodT.rows, workoutRows: workT.rows, dailyRows: dailyT.rows })
  const trend = weightTrend(dailyT.rows, day, 30).map(p => ({ x: p.x, y: p.avg, tip: `${p.x.slice(5)}  7日均 ${p.avg ?? '—'} kg${p.y != null ? ` · 实测 ${p.y}` : ''}` }))
  const t = SHAPE_PLAN.daily
  const n = planDay(day)
  const isToday = day === today

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: mobile ? 20 : 22, fontWeight: 700 }}>💪 {SHAPE_PLAN.title}</div>
          <div style={subtle}>{n >= 1 ? `第 ${n} 天` : `${SHAPE_PLAN.start} 开始`} · 生酮减脂</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DayBtn onClick={() => setDay(addDays(day, -1))}>‹</DayBtn>
          <button onClick={() => setDay(today)} style={{ ...dayBtn, minWidth: 110, fontWeight: 600 }}>{isToday ? '今天' : day.slice(5)} · 周{WEEKDAY[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]}</button>
          <DayBtn onClick={() => setDay(addDays(day, 1))} disabled={day >= today}>›</DayBtn>
        </div>
      </div>

      {missing && <TableMissing sql="v18_shape.sql" />}

      <TopSummary totals={totals} food={food} isToday={isToday} mobile={mobile} onRecipe={() => setPage('recipe')} />

      <MealsCard food={food} workouts={workouts} isToday={isToday} mobile={mobile} />

      <Card title="📅 本周" extra={<span style={subtle}>蛋白达标 {week.proteinDays} 天 · 力量 {week.strength}/{SHAPE_PLAN.weekly.strength} · 有氧 {week.aerobicMin}/{SHAPE_PLAN.weekly.aerobicMin} 分钟</span>}>
        <ScrollX>
          <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: COLORS.textLight }}>
                {['', '热量', '蛋白', '净碳', '饱和脂肪', '力量', '体重'].map(h => <th key={h} style={{ ...cell, fontWeight: 500, textAlign: h ? 'center' : 'left' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {week.days.map((d, i) => (
                <tr key={d.day} onClick={() => d.day <= today && setDay(d.day)} style={{ cursor: d.day <= today ? 'pointer' : 'default', background: d.day === day ? '#EFF6FF' : undefined, color: d.day > today ? COLORS.textLight : COLORS.text }}>
                  <td style={cell}>周{WEEKDAY[i]} <span style={subtle}>{d.day.slice(5)}</span></td>
                  <td style={cellC}><Mark ok={d.checks.kcal} text={d.logged && d.totals.kcal ? fmt(d.totals.kcal) : ''} /></td>
                  <td style={cellC}><Mark ok={d.checks.protein} text={d.checks.protein != null ? `${fmt(d.totals.protein)}g` : ''} /></td>
                  <td style={cellC}><Mark ok={d.checks.netCarb} text={d.checks.netCarb != null ? `${d.totals.netCarb}g` : ''} /></td>
                  <td style={cellC}><Mark ok={d.checks.satFat} text={d.totals.satFat != null ? `${fmt(d.totals.satFat)}g` : ''} /></td>
                  <td style={cellC}>{d.checks.trained ? <span style={{ color: COLORS.green }}>✓</span> : <span style={{ color: COLORS.textLight }}>·</span>}</td>
                  <td style={cellC}>{d.weight ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </Card>

      <Card title="⚖️ 体重（7 日平均）" extra={<span style={subtle}>目标每周降 0.4–0.7 kg</span>}>
        <TrendChart data={trend} unit="kg" height={mobile ? 170 : 110} />
      </Card>

      <details style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 18px' }}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>更多：教练点评 · 能量缺口 · 计划要点</summary>
        <div style={{ fontSize: 13, lineHeight: 1.9, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <b>🧑‍🏫 教练点评</b>
            <div style={{ whiteSpace: 'pre-wrap' }}>{daily?.coach_note || <span style={subtle}>这天还没有点评。</span>}</div>
          </div>
          <div>
            <b>能量缺口（估算）</b>：{food.length ? `${fmt(energy.deficit)} kcal` : '—'} <span style={subtle}>= 基础 {fmt(energy.base)} + 活动 {fmt(energy.activity)} − 摄入 {fmt(energy.intake)}；目标约 500</span>
            <div style={subtle}>体重 {daily?.weight_kg ?? '—'} kg · 腰围 {daily?.waist_cm ?? '—'} cm · 睡眠 {daily?.sleep_h ?? '—'} h · 步数 {daily?.steps != null ? fmt(daily.steps) : '—'}{daily?.feeling ? ` · ${daily.feeling}` : ''}</div>
          </div>
          <div>
            <b>计划要点</b>
            <div>饮食：蛋白 ≥ {t.protein}g → 净碳 ≤ {t.netCarb}g → 脂肪补足（上限约 {t.fat}g，饱和 ≤ {t.satFat}g）；热量 {fmt(t.kcalFloor)}–{fmt(t.kcal)}；水 3–3.5L。</div>
            <div>训练：每周 3 次力量 + 有氧 {SHAPE_PLAN.weekly.aerobicMin} 分钟，每天 {fmt(t.steps)} 步；喝酒或熬夜后的第二天只做低强度。</div>
            <div style={subtle}>吃了什么在对话里或 TG 里说一声就会记进来。<button onClick={() => setPage('recipe')} style={linkBtn}>看食谱 ›</button></div>
          </div>
        </div>
      </details>
    </div>
  )
}

// ── 顶部：蛋白、热量两个大数字 + 一句话建议 ──
function TopSummary({ totals, food, isToday, mobile, onRecipe }) {
  const L = LIMITS
  const p = totals.protein || 0, kcal = totals.kcal || 0
  const pGap = r1(L.protein - p)
  const kcalTone = kcal < L.kcalFloor ? 'short' : kcal <= L.kcalCap ? 'ok' : 'over'
  const kcalNote = kcalTone === 'short' ? `还差 ${fmt(L.kcalFloor - kcal)}` : kcalTone === 'ok' ? '✓ 刚好' : `超了 ${fmt(kcal - L.kcalCap)}`
  const f = totals.fat || 0
  const fatTone = f < L.fatMin ? 'short' : f <= L.fat ? 'ok' : 'over'
  const fatNote = fatTone === 'short' ? `还差 ${fmt(L.fatMin - f)}g` : fatTone === 'ok' ? '✓ 在范围内' : `超了 ${fmt(f - L.fat)}g`
  return (
    <Card style={{ border: `1.5px solid ${COLORS.primary}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: mobile ? 8 : 24 }}>
        <BigStat mobile={mobile} label="蛋白" value={fmt(p)} unit={`/ ${L.protein}g`} pct={p / L.protein} note={pGap > 0 ? `还差 ${pGap}g` : '✓ 够了'} tone={pGap > 0 ? 'short' : 'ok'} />
        <BigStat mobile={mobile} label="热量" value={fmt(kcal)} unit={mobile ? '' : `/ ${fmt(L.kcalFloor)}–${fmt(L.kcalCap)}`} pct={kcal / L.kcalCap} note={kcalNote} tone={kcalTone} />
        <BigStat mobile={mobile} label="脂肪" value={fmt(f)} unit={`/ ${L.fatMin}–${L.fat}g`} pct={f / L.fat} note={fatNote} tone={fatTone} />
      </div>
      {mobile && <div style={{ ...subtle, marginTop: 4 }}>热量目标 {fmt(L.kcalFloor)}–{fmt(L.kcalCap)} kcal</div>}
      <Caps totals={totals} />
      <Electrolytes totals={totals} />
      {isToday && <Advice totals={totals} food={food} mobile={mobile} onRecipe={onRecipe} />}
    </Card>
  )
}

function BigStat({ label, value, unit, pct, note, tone, mobile }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={subtle}>{label}</div>
      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ fontSize: mobile ? 22 : 30, fontWeight: 700 }}>{value}</span>{unit && <span style={{ fontSize: mobile ? 11 : 12, color: COLORS.textLight }}> {unit}</span>}</div>
      <div style={{ height: 6, background: COLORS.bg, borderRadius: 3, overflow: 'hidden', margin: '4px 0' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, height: '100%', background: TONE[tone], borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: mobile ? 13 : 14, fontWeight: 700, color: TONE[tone] }}>{note}</div>
    </div>
  )
}

// 脂肪 / 饱和脂肪 / 净碳：一行小字，超了标红，快到上限标橙
function Caps({ totals }) {
  const L = LIMITS
  const items = [['饱和脂肪', totals.satFat, L.satFat], ['净碳', totals.netCarb, L.netCarb]]
  return (
    <div style={{ ...subtle, marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
      {items.map(([label, v, cap]) => {
        const color = v == null ? COLORS.textLight : v > cap ? COLORS.red : v >= cap * 0.9 ? COLORS.orange : COLORS.textLight
        return <span key={label} style={{ color }}>{label} {v == null ? '未估' : r1(v)}/{cap}g</span>
      })}
    </div>
  )
}

function Advice({ totals, food, mobile, onRecipe }) {
  const s = suggest(totals, { cpEaten: cpBagsEaten(food) })
  const box = { marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 14, lineHeight: 1.6 }
  if (s.status === 'empty') return <div style={{ ...box, background: COLORS.bg }}>今天还没记录。<button onClick={onRecipe} style={linkBtn}>照食谱基线吃 ›</button></div>
  if (s.status === 'done') return <div style={{ ...box, background: '#ECFDF5', color: COLORS.green, fontWeight: 600 }}>✅ 今天够了，不用再吃</div>
  if (s.status === 'over') return <div style={{ ...box, background: '#FEF2F2', color: COLORS.red }}>⚠ {s.over.join('、')}超了，今天别再加</div>
  const options = s.options.slice(0, 2)
  return (
    <div style={{ ...box, background: '#EFF6FF' }}>
      <div style={{ fontWeight: 600 }}>👉 {s.status === 'protein' ? '还要补一顿，二选一：' : '热量还不够，加一样：'}</div>
      {s.over.length > 0 && <div style={{ fontSize: 12, color: COLORS.red }}>⚠ {s.over.join('、')}已经超了</div>}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8, marginTop: 6 }}>
        {options.map(o => (
          <div key={o.key + o.main} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '6px 8px', border: `1px solid ${o.warn.length ? '#FECACA' : COLORS.border}` }}>
            <FoodImg k={o.key} size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{o.main}{o.side ? ` + ${o.side}` : ''}</div>
              <div style={subtle}>吃完 {fmt(o.after.kcal)} kcal · 蛋白 {fmt(o.after.p)}g · 脂肪 {fmt(o.after.f)}g</div>
              {o.warn[0] && <div style={{ fontSize: 12, color: COLORS.red }}>⚠ {o.warn[0]}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 今天吃了：每顿一个标题，下面逐条食物（左图右字）──
function MealsCard({ food, workouts, isToday, mobile }) {
  const cards = mealCards(food)
  return (
    <Card title={isToday ? '🍽 今天吃了' : '🍽 这天吃了'}>
      {cards.length === 0 && workouts.length === 0 && <div style={subtle}>{isToday ? '还没有记录。吃了什么在对话里或 TG 里说一声就行。' : '这天没有记录。'}</div>}
      {cards.map((c, idx) => (
        <div key={c.id} style={{ borderTop: idx ? `1px solid ${COLORS.border}` : 'none', paddingTop: idx ? 10 : 0, marginTop: idx ? 10 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 10px' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{c.title}<span style={{ ...subtle, fontWeight: 400 }}>{c.time ? ` · ${c.time}` : ''}</span></div>
            <div style={{ fontSize: 13 }}>{fmt(c.kcal)} kcal · <b>蛋白 {fmt(c.p)}g</b> · 脂肪 {fmt(c.f)}g</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '6px 16px', marginTop: 8 }}>
            {c.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {it.img ? <FoodImg k={it.img} size={40} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍽</div>}
                <div style={{ fontSize: 14, minWidth: 0 }}>{it.text}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {workouts.length > 0 && (
        <div style={{ marginTop: cards.length ? 12 : 0, paddingTop: cards.length ? 10 : 0, borderTop: cards.length ? `1px solid ${COLORS.border}` : 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {workouts.map(w => (
            <div key={w.id} style={{ fontSize: 14 }}>
              {w.kind === 'strength' ? '🏋️' : '🏃'} <b>{WORKOUT_KINDS[w.kind] || w.kind}</b> · {w.title.replace(/^(力量|有氧)\s*·\s*/, '')}
              <span style={subtle}>{w.duration_min ? ` · ${fmt(w.duration_min)} 分钟` : ''}{w.kcal ? ` · 约 ${fmt(w.kcal)} kcal` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// 电解质（mg）：钠看食物；钾、镁把每天按清单吃的补剂加上。没记录时不显示
function Electrolytes({ totals }) {
  const d = SHAPE_PLAN.daily, sup = SHAPE_PLAN.supplements
  if (totals.sodium == null && totals.potassium == null && totals.magnesium == null) return null
  const na = totals.sodium || 0, k = (totals.potassium || 0) + sup.potassium, mg = (totals.magnesium || 0) + sup.magnesium
  const item = (label, text, color) => <span style={{ color }}>{label} {text}</span>
  return (
    <div style={{ ...subtle, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
      <span>电解质（mg）</span>
      {item('钠', `${fmt(na)}/${fmt(d.sodiumMax)}`, na > d.sodiumMax ? COLORS.red : COLORS.textLight)}
      {item('钾', `${fmt(totals.potassium || 0)}+补剂${sup.potassium}/${fmt(d.potassiumMin)}`, k < d.potassiumMin ? COLORS.orange : COLORS.textLight)}
      {item('镁', `${fmt(totals.magnesium || 0)}+补剂${sup.magnesium}/${d.magnesiumMin}`, mg < d.magnesiumMin ? COLORS.orange : COLORS.textLight)}
    </div>
  )
}

const dayBtn = { minHeight: 36, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.text, fontSize: 13, cursor: 'pointer', padding: '0 10px' }
const cell = { padding: '7px 6px', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap', textAlign: 'left' }
const cellC = { ...cell, textAlign: 'center' }
const linkBtn = { border: 'none', background: 'none', color: COLORS.primaryDark, cursor: 'pointer', padding: 0, fontSize: 13 }

function DayBtn({ children, ...rest }) {
  return <button {...rest} style={{ ...dayBtn, width: 36, padding: 0, opacity: rest.disabled ? 0.4 : 1 }}>{children}</button>
}

function Mark({ ok, text }) {
  const s = STATUS[String(ok)]
  return <span><span style={{ color: s.color }}>{s.icon}</span>{text && <span style={{ marginLeft: 4 }}>{text}</span>}</span>
}
