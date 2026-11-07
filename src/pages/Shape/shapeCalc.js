// 健康塑形页的纯计算：汇总当天摄入、估算能量收支、判断达标、整理一周与体重趋势。
// 不碰数据库，方便单测（shapeCalc.test.mjs）。
import { SHAPE_PLAN } from './shapePlan.js'

const num = v => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d

// 纯 UTC 日期运算，避免时区把 YYYY-MM-DD 推到前一天
export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function weekOf(day) {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7 // 周一=0
  const monday = addDays(day, -weekday)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// satFat：没有任何一条填了饱和脂肪时为 null（老记录或没估），避免把「没记」显示成 0g 达标
export function sumFood(rows) {
  const t = rows.reduce((a, r) => ({
    kcal: a.kcal + num(r.kcal), protein: a.protein + num(r.protein_g),
    fat: a.fat + num(r.fat_g), satFat: a.satFat + num(r.sat_fat_g), netCarb: a.netCarb + num(r.net_carb_g),
  }), { kcal: 0, protein: 0, fat: 0, satFat: 0, netCarb: 0 })
  const hasSat = rows.some(r => r.sat_fat_g != null && r.sat_fat_g !== '')
  return { kcal: round(t.kcal), protein: round(t.protein), fat: round(t.fat), satFat: hasSat ? round(t.satFat) : null, netCarb: round(t.netCarb, 1) }
}

// 有氧分钟：专门的有氧和出去走的那种（kind=cardio/walk），日常步数不算
export function aerobicMinutes(workouts) {
  return round(workouts.filter(w => w.kind === 'cardio' || w.kind === 'walk').reduce((a, w) => a + num(w.duration_min), 0))
}

// Mifflin-St Jeor 基础代谢
export function bmr({ weightKg, heightCm, age, sex }) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5)
}

// 当天或之前最近一次体重；都没有就用计划里的基线
export function weightOn(dailyRows, day, fallback = SHAPE_PLAN.profile.weightKg) {
  const hit = dailyRows.filter(r => r.weight_kg != null && r.log_date <= day)
    .sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
  return hit ? num(hit.weight_kg) : fallback
}

// 能量收支（估算）：
//   基础消耗 = 基础代谢 × 1.1（含消化食物的热效应）
//   活动消耗 = 手表「活动能量」（已含训练和走路）；没有手表数据时 = 训练估算 + 步数 × 0.0005 × 体重
//   缺口 = 基础 + 活动 − 摄入（正数 = 在减脂）
export function energyBalance({ food, workouts, daily, weightKg, profile = SHAPE_PLAN.profile }) {
  const intake = sumFood(food).kcal
  const base = round(bmr({ ...profile, weightKg }) * 1.1)
  const watch = daily?.active_kcal != null && daily.active_kcal !== ''
  const workoutKcal = workouts.reduce((a, w) => a + num(w.kcal), 0)
  const stepKcal = num(daily?.steps) * 0.0005 * weightKg
  const activity = round(watch ? num(daily.active_kcal) : workoutKcal + stepKcal)
  return { intake, base, activity, activitySource: watch ? 'watch' : 'estimate', deficit: round(base + activity - intake) }
}

// 当天各项是否达标。没有记录的项为 null（显示「未记录」），不算失败
export function dayChecks({ food, workouts, daily, targets = SHAPE_PLAN.daily }) {
  const t = sumFood(food)
  const logged = food.length > 0
  return {
    kcal: logged ? t.kcal <= targets.kcal + 100 : null,
    protein: logged ? t.protein >= targets.protein : null,
    netCarb: logged ? t.netCarb <= targets.netCarb : null,
    fat: logged ? t.fat <= targets.fat : null,
    satFat: t.satFat != null ? t.satFat <= targets.satFat : null,
    steps: daily?.steps != null ? num(daily.steps) >= targets.steps : null,
    trained: workouts.some(w => w.kind === 'strength'),
  }
}

export function byDate(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!m.has(r.log_date)) m.set(r.log_date, [])
    m.get(r.log_date).push(r)
  }
  return m
}

// 一周（周一到周日）每天的摘要 + 周合计
export function weekSummary({ day, foodRows, workoutRows, dailyRows }) {
  const food = byDate(foodRows), work = byDate(workoutRows)
  const daily = new Map(dailyRows.map(r => [r.log_date, r]))
  const days = weekOf(day).map(d => {
    const f = food.get(d) || [], w = work.get(d) || [], dl = daily.get(d)
    return { day: d, totals: sumFood(f), checks: dayChecks({ food: f, workouts: w, daily: dl }), weight: dl?.weight_kg ?? null, steps: dl?.steps ?? null, logged: f.length > 0 || w.length > 0 || !!dl }
  })
  const weights = days.map(d => d.weight).filter(v => v != null).map(Number)
  return {
    days,
    strength: days.filter(d => d.checks.trained).length,
    aerobicMin: aerobicMinutes(workoutRows.filter(w => days.some(d => d.day === w.log_date))),
    proteinDays: days.filter(d => d.checks.protein).length,
    loggedDays: days.filter(d => d.logged).length,
    avgWeight: weights.length ? round(weights.reduce((a, b) => a + b, 0) / weights.length, 1) : null,
  }
}

// 体重趋势：每天的实测值 + 7 日平均（单日波动大，看平均）
export function weightTrend(dailyRows, endDay, days = 30) {
  const points = new Map(dailyRows.filter(r => r.weight_kg != null).map(r => [r.log_date, num(r.weight_kg)]))
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(endDay, -i)
    const window = Array.from({ length: 7 }, (_, k) => points.get(addDays(d, -k))).filter(v => v != null)
    out.push({ x: d, y: points.get(d) ?? null, avg: window.length ? round(window.reduce((a, b) => a + b, 0) / window.length, 1) : null })
  }
  const first = out.findIndex(p => p.y != null)
  return first < 0 ? [] : out.slice(first)
}

export function planDay(day, start = SHAPE_PLAN.start) {
  return Math.round((new Date(`${day}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1
}
