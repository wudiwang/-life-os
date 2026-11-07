// 健康塑形：当前唯一主线的数据呈现页。录入不在这里——聊天入口的 AI 按
// docs/塑形数据录入总则.md 写 shape_food_logs / shape_workouts / shape_daily，这页只负责看。
import { useState } from 'react'
import { COLORS } from '../../lib/constants'
import { Card, ScrollX } from '../../components/common/StatCard'
import { TrendChart } from '../../components/common/TrendChart'
import { TableMissing } from '../../components/common/TableMissing'
import { useTable } from '../../hooks/useTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import { bangkokDay } from '../../lib/dailyActions'
import { useUIStore } from '../../store/useUIStore'
import { SHAPE_PLAN, MEALS, WORKOUT_KINDS } from './shapePlan'
import { addDays, sumFood, weightOn, energyBalance, weekSummary, weightTrend, planDay } from './shapeCalc'
import { remainingRows, suggest, cpBagsEaten } from './shapeSuggest'
import { FoodImg } from './FoodImg'

const subtle = { fontSize: 12, color: COLORS.textLight, lineHeight: 1.6 }
const fmt = n => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))
const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日']
const STATUS = {
  true: { icon: '✓', label: '达标', color: COLORS.green },
  false: { icon: '✗', label: '未达标', color: COLORS.red },
  null: { icon: '·', label: '未记录', color: COLORS.textLight },
}

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
    .sort((a, b) => MEALS.findIndex(m => m.key === a.meal) - MEALS.findIndex(m => m.key === b.meal) || String(a.created_at).localeCompare(String(b.created_at)))
  const workouts = workT.rows.filter(r => r.log_date === day)
  const daily = dailyT.rows.find(r => r.log_date === day) || null
  const totals = sumFood(food)
  const weightKg = weightOn(dailyT.rows, day)
  const energy = energyBalance({ food, workouts, daily, weightKg })
  const week = weekSummary({ day, foodRows: foodT.rows, workoutRows: workT.rows, dailyRows: dailyT.rows })
  const trend = weightTrend(dailyT.rows, day, 30).map(p => ({ x: p.x, y: p.avg, tip: `${p.x.slice(5)}  7日均 ${p.avg ?? '—'} kg${p.y != null ? ` · 实测 ${p.y}` : ''}` }))
  const t = SHAPE_PLAN.daily
  const n = planDay(day)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: mobile ? 20 : 22, fontWeight: 700 }}>💪 {SHAPE_PLAN.title}</div>
          <div style={subtle}>{n >= 1 ? `第 ${n} 天 · 第 ${Math.ceil(n / 7)} / ${SHAPE_PLAN.weeks} 周` : `${SHAPE_PLAN.start} 开始`} · 生酮 {t.kcal} kcal · 蛋白 {t.protein}g · 每周力量 {SHAPE_PLAN.weekly.strength} 次 + 有氧 {SHAPE_PLAN.weekly.aerobicMin} 分钟</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DayBtn onClick={() => setDay(addDays(day, -1))}>‹</DayBtn>
          <button onClick={() => setDay(today)} style={{ ...dayBtn, minWidth: 110, fontWeight: 600 }}>{day === today ? '今天' : day.slice(5)} · 周{WEEKDAY[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]}</button>
          <DayBtn onClick={() => setDay(addDays(day, 1))} disabled={day >= today}>›</DayBtn>
        </div>
      </div>

      {missing && <TableMissing sql="v18_shape.sql" />}

      <RemainingCard totals={totals} steps={daily?.steps ?? null} food={food} isToday={day === today} mobile={mobile} onRecipe={() => setPage('recipe')} />

      <TodayLog food={food} workouts={workouts} isToday={day === today} week={week} />

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 18px' }}>
          <div>
            <div style={subtle}>今日能量缺口（估算）</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>{food.length ? `${fmt(energy.deficit)} kcal` : '—'}</div>
          </div>
          <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.8 }}>
            基础 {fmt(energy.base)} + 活动 {fmt(energy.activity)} − 摄入 {fmt(energy.intake)}
            <div style={subtle}>活动消耗{energy.activitySource === 'watch' ? '取自手表「活动能量」' : '按训练记录 + 步数估算'}；目标缺口约 500，缺口过大会掉肌肉</div>
          </div>
          <div style={{ marginLeft: mobile ? 0 : 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
            <Fact label="体重" value={daily?.weight_kg != null ? `${daily.weight_kg} kg` : '—'} />
            <Fact label="腰围" value={daily?.waist_cm != null ? `${daily.waist_cm} cm` : '—'} />
            <Fact label="睡眠" value={daily?.sleep_h != null ? `${daily.sleep_h} h` : '—'} />
          </div>
        </div>
        {daily?.feeling && <div style={{ ...subtle, marginTop: 8 }}>感受：{daily.feeling}</div>}
      </Card>

      <Card title="🧑‍🏫 教练点评" style={{ background: daily?.coach_note ? '#EFF6FF' : '#fff' }}>
        {daily?.coach_note
          ? <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{daily.coach_note}</div>
          : <div style={subtle}>{day === today ? '还没收到今天的日报。在 TG 发给大仙：食物照片、训练内容、体重、步数，点评会出现在这里。' : '这天没有点评。'}</div>}
      </Card>

      <Card title="📅 本周" extra={<span style={subtle}>记录 {week.loggedDays}/7 天 · 蛋白达标 {week.proteinDays} 天 · 平均体重 {week.avgWeight ?? '—'} kg</span>}>
        <ScrollX>
          <table style={{ width: '100%', minWidth: 580, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: COLORS.textLight }}>
                {['', '热量', '蛋白', '净碳', '饱和脂肪', '步数', '力量', '体重'].map(h => <th key={h} style={{ ...cell, fontWeight: 500, textAlign: h ? 'center' : 'left' }}>{h}</th>)}
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
                  <td style={cellC}><Mark ok={d.checks.steps} text={d.steps != null ? fmt(d.steps) : ''} /></td>
                  <td style={cellC}>{d.checks.trained ? <span style={{ color: COLORS.green }}>✓ <span style={{ color: COLORS.text }}>练了</span></span> : <span style={{ color: COLORS.textLight }}>·</span>}</td>
                  <td style={cellC}>{d.weight ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
        <div style={{ ...subtle, marginTop: 6 }}>点某一天可以看当天详情。✓ 达标 · ✗ 未达标 · 「·」未记录</div>
      </Card>

      <Card title="⚖️ 体重趋势（7 日平均）" extra={<span style={subtle}>看平均线；目标每周降 0.4–0.7 kg</span>}>
        <TrendChart data={trend} unit="kg" height={mobile ? 170 : 110} />
      </Card>

      <details style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 18px' }}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>📋 怎么记录 · 计划要点</summary>
        <div style={{ fontSize: 13, lineHeight: 1.9, marginTop: 8 }}>
          <div><b>每天晚上在 TG 发给大仙</b>：早上空腹体重；每餐照片（包装食品第一次拍营养成分表）；训练内容（动作 × 重量 × 组 × 次，或「休息」）；步数或手表截图；一句感受。照片和口述都行，大仙会算好热量、蛋白、运动消耗并写进这一页。</div>
          <div><b>每周日</b>加腰围（最低肋骨和胯骨连线中点，早上空腹、呼气末量两次）；<b>每月</b>加 InBody、正侧背照片、抽血报告；血压用上臂式血压计，早晚各量 2 次。</div>
          <div><b>训练</b>：每周 3 次全身力量（A/B 交替）+ 有氧 {SHAPE_PLAN.weekly.aerobicMin} 分钟（心率约 118–140，坡度走/骑车/游泳），每天 {t.steps.toLocaleString()} 步，大餐后走 10–15 分钟；喝酒或熬夜后的第二天只走路。</div>
          <div><b>饮食</b>：顺序是热量 {t.kcal} kcal → 蛋白 ≥ {t.protein}g → 净碳 ≤ {t.netCarb}g → 脂肪补足剩余（上限约 {t.fat}g，不是要吃够）。饱和脂肪 ≤ {t.satFat}g：不喝防弹咖啡，少用黄油、椰子油、椰浆、五花肉；油用橄榄油、牛油果、坚果，每周 2–3 次多脂鱼。水 3–3.5L，前 4 周不喝酒。</div>
          <div style={subtle}>完整计划见项目 docs/健康塑形计划.md。<button onClick={() => setPage('recipe')} style={{ border: 'none', background: 'none', color: COLORS.primaryDark, cursor: 'pointer', padding: 0, fontSize: 12 }}>看食谱（基线、一周、蛋白替换、电解质与喝水）›</button></div>
        </div>
      </details>
    </div>
  )
}

const dayBtn = { minHeight: 36, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.text, fontSize: 13, cursor: 'pointer', padding: '0 10px' }
const cell = { padding: '7px 6px', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap', textAlign: 'left' }
const cellC = { ...cell, textAlign: 'center' }

function DayBtn({ children, ...rest }) {
  return <button {...rest} style={{ ...dayBtn, width: 36, padding: 0, opacity: rest.disabled ? 0.4 : 1 }}>{children}</button>
}

function Fact({ label, value }) {
  return <div><div style={subtle}>{label}</div><div style={{ fontWeight: 600 }}>{value}</div></div>
}

function Mark({ ok, text }) {
  const s = STATUS[String(ok)]
  return <span><span style={{ color: s.color }}>{s.icon}</span>{text && <span style={{ marginLeft: 4 }}>{text}</span>}</span>
}

const MEAL_ICON = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🥜' }
const GAP_COLOR = { short: COLORS.orange, over: COLORS.red, ok: COLORS.green, room: COLORS.textLight, none: COLORS.textLight }

// 首页第一张卡：已吃 / 目标 / 还差，今天的话再给「再吃什么」的建议（算法在 shapeSuggest.js）
function RemainingCard({ totals, steps, food, isToday, mobile, onRecipe }) {
  const rows = remainingRows(totals, steps)
  const s = suggest(totals, { cpEaten: cpBagsEaten(food) })
  const th = { ...cell, fontWeight: 500, color: COLORS.textLight, fontSize: 12 }
  const td = { ...cell, whiteSpace: 'normal', verticalAlign: 'top', fontSize: 13 }
  return (
    <Card title={isToday ? '🎯 今天还差多少' : '🎯 这天的结果'} extra={<span style={subtle}>{food.length ? `已记 ${food.length} 餐` : '还没记录饮食'}</span>} style={{ border: `1.5px solid ${COLORS.primary}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: mobile ? '19%' : '16%' }} /><col style={{ width: mobile ? '22%' : '20%' }} /><col style={{ width: mobile ? '27%' : '24%' }} /><col /></colgroup>
        <thead><tr><th style={th}>项目</th><th style={th}>已吃</th><th style={th}>目标</th><th style={th}>还差</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td style={{ ...td, fontWeight: 600 }}>{r.label}</td>
              <td style={td}>{r.eaten}</td>
              <td style={{ ...td, color: COLORS.textLight }}>{r.target}</td>
              <td style={td}>
                <span style={{ color: GAP_COLOR[r.status], fontWeight: r.status === 'short' || r.status === 'over' ? 700 : 400 }}>{r.gap}</span>
                {r.sub && <div style={subtle}>{r.sub}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isToday && <SuggestBlock s={s} mobile={mobile} onRecipe={onRecipe} />}
    </Card>
  )
}

function SuggestBlock({ s, mobile, onRecipe }) {
  const box = { marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.7 }
  const overNote = s.over.length > 0 && <div style={{ ...box, background: '#FEF2F2', color: COLORS.red }}>⚠ 今天{s.over.join('、')}已经超了，剩下的时间别再往这上面加；明天按基线吃回来。</div>
  if (s.status === 'empty') {
    return <div style={{ ...box, background: COLORS.bg }}>今天还没记录饮食。照「食谱」的基线吃：早餐 3 个蛋 + 1 袋 CP + 绿叶菜 + 半个牛油果，午餐 3 份蛋白，晚餐一份鱼或肉。<button onClick={onRecipe} style={linkBtn}>看食谱 ›</button></div>
  }
  if (s.status === 'done') return <div style={{ ...box, background: '#ECFDF5', color: COLORS.green }}>✅ 今天蛋白、热量都到位了，其余都没超，不用再吃了。</div>
  if (s.status === 'over') return overNote
  const head = s.status === 'protein'
    ? <>👉 <b>蛋白还差 {s.need.p}g</b>{s.need.kcal > 0 ? `，热量离 1,500 底线还差 ${s.need.kcal}` : ''}。任选一种（需要的配菜已经算进去）：</>
    : <>👉 蛋白够了，<b>热量还差 {s.need.kcal}</b>。挑一两样补上（脂肪不用特意补，这是为了别吃太少）：</>
  return (
    <>
      {overNote}
      <div style={{ ...box, background: '#EFF6FF', paddingBottom: 4 }}>
        <div>{head}</div>
        {s.note && <div style={subtle}>{s.note}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8, margin: '8px 0' }}>
          {s.options.map(o => (
            <div key={o.key + o.main} style={{ display: 'flex', gap: 10, background: '#fff', borderRadius: 10, padding: '8px 10px', border: `1px solid ${o.warn.length ? '#FECACA' : COLORS.border}` }}>
              <FoodImg k={o.key} size={44} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{o.main}</div>
                {o.side && <div style={{ fontSize: 12 }}>配 {o.side}</div>}
                <div style={subtle}>+{o.gain.p}g 蛋白 · +{fmt(o.gain.kcal)} kcal</div>
                <div style={{ fontSize: 12 }}>吃完：<span style={{ color: o.after.kcal < SHAPE_PLAN.daily.kcalFloor ? COLORS.orange : COLORS.text }}>{fmt(o.after.kcal)} kcal</span> · 蛋白 {o.after.p}g · 饱和 {o.after.sfa}g</div>
                {o.warn.map(w => <div key={w} style={{ fontSize: 12, color: COLORS.red }}>⚠ {w}</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// 今天吃了什么、练了什么（原来的饮食 / 训练两张卡合在一起）
function TodayLog({ food, workouts, isToday, week }) {
  return (
    <Card title={isToday ? '📝 今天吃了 · 练了' : '📝 这天吃了 · 练了'} extra={<span style={subtle}>本周力量 {week.strength} / {SHAPE_PLAN.weekly.strength} · 有氧 {week.aerobicMin} / {SHAPE_PLAN.weekly.aerobicMin} 分钟</span>}>
      {food.length === 0 && workouts.length === 0 && <div style={subtle}>{isToday ? '今天还没有记录。在 TG 发给大仙，或者直接在对话里告诉 AI。' : '这天没有记录。'}</div>}
      {food.map(r => (
        <div key={r.id} style={{ padding: '8px 0', borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 8px' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{MEAL_ICON[r.meal] || '🍽'} {MEALS.find(m => m.key === r.meal)?.label || r.meal}</span>
            <span style={{ fontSize: 12, color: COLORS.text }}>{fmt(r.kcal)} kcal · <b>蛋白 {fmt(r.protein_g)}g</b> · 脂肪 {fmt(r.fat_g)}g{r.sat_fat_g != null ? `（饱和 ${fmt(r.sat_fat_g)}g）` : ''} · 净碳 {fmt(r.net_carb_g)}g</span>
          </div>
          <div style={{ ...subtle, color: COLORS.text }}>{r.items}</div>
          {r.note && <div style={subtle}>{r.note}</div>}
        </div>
      ))}
      {workouts.map(w => (
        <div key={w.id} style={{ padding: '8px 0', borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 8px' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{w.kind === 'strength' ? '🏋️' : '🏃'} {WORKOUT_KINDS[w.kind] || w.kind} · {w.title}</span>
            <span style={{ fontSize: 12, color: COLORS.text }}>{w.duration_min ? `${fmt(w.duration_min)} 分钟` : ''}{w.duration_min && w.kcal ? ' · ' : ''}{w.kcal ? `约 ${fmt(w.kcal)} kcal` : ''}</span>
          </div>
          {w.detail && <div style={{ ...subtle, color: COLORS.text, whiteSpace: 'pre-wrap' }}>{w.detail}</div>}
        </div>
      ))}
    </Card>
  )
}

const linkBtn = { border: 'none', background: 'none', color: COLORS.primaryDark, cursor: 'pointer', padding: 0, fontSize: 13 }
