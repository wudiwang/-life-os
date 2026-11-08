// 首页「今天还差多少」：已吃 vs 目标的差额，以及「再吃什么」的具体建议
// （哪种蛋白吃多少克、要不要配菜、吃完全天各项是多少、会不会超）。
// 纯计算，ShapePage 只呈现；npm run test:shape 覆盖（shapeSuggest.test.mjs）。
import { SHAPE_PLAN } from './shapePlan.js'
import { RECIPE_FOODS, sumItems, amountLabel } from './shapeRecipe.js'

const d = SHAPE_PLAN.daily
export const LIMITS = {
  protein: d.protein,     // 下限
  kcalFloor: d.kcalFloor, // 底线
  kcalCap: d.kcal,        // 上限参考
  fat: d.fat,             // 上限
  fatMin: d.fatMin,       // 下限
  satFat: d.satFat,       // 上限
  netCarb: d.netCarb,     // 上限
  steps: d.steps,         // 下限
  cpBags: 4,              // CP 一天 ≤ 4 袋（每袋钠 310mg）
}
export const MEAL_MAX_PROTEIN = 60 // 一顿最多按 60g 蛋白建议，剩下的下一顿再补
export const MAIN_MEAL_PROTEIN = 40 // 热量还不到底线时，正餐至少按 40g 蛋白建议（差得少也吃一顿像样的）

// 补蛋白的候选（按顺序展示，不会超标的排前面）；补热量的加项；蛋白建议吃完热量仍低于底线时加的配菜
const PROTEIN_OPTIONS = ['chickenBreast', 'beefLean', 'shrimp', 'cp', 'mackerel']
const KCAL_ADDONS = [[['choySum', 200], ['oliveOil', 10]], [['avocado', 70]], [['almond', 20]], [['pumpkinSeed', 20]]]
// 先试「菜 + 油」，会超就只加菜；碳水已经满了就只淋油
const SIDES = [[['choySum', 200], ['oliveOil', 10]], [['choySum', 200]], [['oliveOil', 15]]]

const r1 = v => Math.round(v * 10) / 10
const fmt = n => Math.round(n).toLocaleString('zh-CN')

// shapeCalc.sumFood 的结构 → 内部统一字段
const norm = t => ({ kcal: t.kcal || 0, p: t.protein || 0, f: t.fat || 0, sfa: t.satFat || 0, c: t.netCarb || 0, sfaKnown: t.satFat != null })

// 今天吃过几袋 CP（从 items 文字里认「CP … 2 袋」）
export function cpBagsEaten(foodRows) {
  let n = 0
  for (const r of foodRows) for (const m of String(r.items || '').matchAll(/CP[^、，,;；]*?(\d+)\s*袋/g)) n += Number(m[1])
  return n
}

// 表格的每一行：已吃 / 目标 / 还差，status: short 还差 / ok 达标 / room 还有额度（上限类）/ over 超了 / none 没记录
export function remainingRows(totals, steps, L = LIMITS) {
  const t = norm(totals)
  const capRow = (key, label, v, cap, unit, extra = '') => v > cap
    ? { key, label, eaten: `${r1(v)}${unit}`, target: `≤ ${cap}${unit}${extra}`, gap: `超了 ${r1(v - cap)}${unit}`, status: 'over' }
    : { key, label, eaten: `${r1(v)}${unit}`, target: `≤ ${cap}${unit}${extra}`, gap: `还剩 ${r1(cap - v)}${unit} 额度`, status: 'room' }
  const rows = [
    t.p >= L.protein
      ? { key: 'protein', label: '蛋白', eaten: `${r1(t.p)}g`, target: `≥ ${L.protein}g`, gap: '✓ 达标', status: 'ok' }
      : { key: 'protein', label: '蛋白', eaten: `${r1(t.p)}g`, target: `≥ ${L.protein}g`, gap: `还差 ${r1(L.protein - t.p)}g`, status: 'short' },
    t.kcal < L.kcalFloor
      ? { key: 'kcal', label: '热量', eaten: fmt(t.kcal), target: `${fmt(L.kcalFloor)}–${fmt(L.kcalCap)}`, gap: `还差 ${fmt(L.kcalFloor - t.kcal)}`, sub: `最多还能吃 ${fmt(L.kcalCap - t.kcal)}`, status: 'short' }
      : t.kcal <= L.kcalCap
        ? { key: 'kcal', label: '热量', eaten: fmt(t.kcal), target: `${fmt(L.kcalFloor)}–${fmt(L.kcalCap)}`, gap: '✓ 在范围内', sub: `还能吃 ${fmt(L.kcalCap - t.kcal)}`, status: 'ok' }
        : { key: 'kcal', label: '热量', eaten: fmt(t.kcal), target: `${fmt(L.kcalFloor)}–${fmt(L.kcalCap)}`, gap: `超了 ${fmt(t.kcal - L.kcalCap)}`, status: 'over' },
    t.f > L.fat
      ? { key: 'fat', label: '脂肪', eaten: `${r1(t.f)}g`, target: `${L.fatMin}–${L.fat}g`, gap: `超了 ${r1(t.f - L.fat)}g`, status: 'over' }
      : t.f < L.fatMin
        ? { key: 'fat', label: '脂肪', eaten: `${r1(t.f)}g`, target: `${L.fatMin}–${L.fat}g`, gap: `还差 ${r1(L.fatMin - t.f)}g`, sub: `最多还能吃 ${r1(L.fat - t.f)}g`, status: 'short' }
        : { key: 'fat', label: '脂肪', eaten: `${r1(t.f)}g`, target: `${L.fatMin}–${L.fat}g`, gap: '✓ 在范围内', sub: `还能吃 ${r1(L.fat - t.f)}g`, status: 'ok' },
    t.sfaKnown ? capRow('satFat', '饱和脂肪', t.sfa, L.satFat, 'g') : { key: 'satFat', label: '饱和脂肪', eaten: '未估', target: `≤ ${L.satFat}g`, gap: '—', status: 'none' },
    capRow('netCarb', '净碳', t.c, L.netCarb, 'g'),
    steps == null
      ? { key: 'steps', label: '步数', eaten: '未记录', target: `≥ ${fmt(L.steps)}`, gap: '—', status: 'none' }
      : steps >= L.steps
        ? { key: 'steps', label: '步数', eaten: fmt(steps), target: `≥ ${fmt(L.steps)}`, gap: '✓ 达标', status: 'ok' }
        : { key: 'steps', label: '步数', eaten: fmt(steps), target: `≥ ${fmt(L.steps)}`, gap: `还差 ${fmt(L.steps - steps)}`, status: 'short' },
  ]
  return rows
}

// 补够 targetP 克蛋白要吃多少：按袋/片的取整数（青花鱼最多 2 片），按克的向上取整到 10g
export function amountFor(key, targetP) {
  const x = RECIPE_FOODS[key]
  if (x.unit) {
    const per = x.p * x.unit.g / 100
    const n = Math.min(key === 'mackerel' ? 2 : 6, Math.max(1, Math.ceil((targetP - 1) / per)))
    return n * x.unit.g
  }
  return Math.max(50, Math.ceil(targetP / x.p * 100 / 10) * 10)
}

function after(t, items) {
  const g = sumItems(items)
  return { kcal: Math.round(t.kcal + g.kcal), p: r1(t.p + g.p), f: r1(t.f + g.f), sfa: r1(t.sfa + g.sfa), c: r1(t.c + g.c) }
}

// 吃完会超的项（只报「吃之前没超、吃了才超」的，已经超的不重复唠叨）
function newOvers(t, a, L) {
  const w = []
  if (a.sfa > L.satFat && t.sfa <= L.satFat) w.push(`饱和脂肪会到 ${a.sfa}g（上限 ${L.satFat}）`)
  if (a.f > L.fat && t.f <= L.fat) w.push(`脂肪会到 ${a.f}g（上限 ${L.fat}）`)
  if (a.c > L.netCarb && t.c <= L.netCarb) w.push(`净碳会到 ${a.c}g（上限 ${L.netCarb}）`)
  if (a.kcal > L.kcalCap && t.kcal <= L.kcalCap) w.push(`热量会到 ${fmt(a.kcal)}（上限 ${fmt(L.kcalCap)}）`)
  return w
}

// 已经超了的项，配菜不能再往上加（比如碳水已满，就不再配菜心）
function worsensOver(t, items, L) {
  const g = sumItems(items)
  return (t.c > L.netCarb && g.c > 0.5) || (t.sfa > L.satFat && g.sfa > 0.5) || (t.f > L.fat && g.f > 0.5)
}

const label = items => items.map(([k, g]) => `${RECIPE_FOODS[k].name} ${amountLabel(k, g)}`).join(' + ')

// 主函数。status：empty 还没记录 / protein 蛋白不够 / kcal 蛋白够了热量不够 / done 全部达标 / over 已经超了
export function suggest(totals, { cpEaten = 0, mealMax = MEAL_MAX_PROTEIN, L = LIMITS } = {}) {
  const t = norm(totals)
  const over = []
  if (t.kcal > L.kcalCap) over.push('热量')
  if (t.f > L.fat) over.push('脂肪')
  if (t.sfa > L.satFat) over.push('饱和脂肪')
  if (t.c > L.netCarb) over.push('净碳')
  if (!t.kcal) return { status: 'empty', over, options: [] }

  const remP = r1(L.protein - t.p)
  if (remP > 0) {
    const thisMeal = t.kcal < L.kcalFloor && remP < MAIN_MEAL_PROTEIN ? MAIN_MEAL_PROTEIN : Math.min(remP, mealMax)
    const options = PROTEIN_OPTIONS.map(key => {
      const main = [[key, amountFor(key, thisMeal)]]
      let items = main
      let a = after(t, items)
      let side = null
      if (a.kcal < L.kcalFloor) {
        for (const s of SIDES) {
          const a2 = after(t, [...main, ...s])
          if (!newOvers(t, a2, L).length && !worsensOver(t, s, L)) { items = [...main, ...s]; a = a2; side = s; break }
        }
      }
      const warn = newOvers(t, a, L)
      const mainG = sumItems(main)
      if (t.c > L.netCarb && mainG.c > 0.5) warn.push(`净碳已经超了，这个还会再加 ${mainG.c}g`)
      if (t.sfa > L.satFat && mainG.sfa > 0.5) warn.push(`饱和脂肪已经超了，这个还会再加 ${mainG.sfa}g`)
      if (key === 'cp') {
        const bags = cpEaten + main[0][1] / RECIPE_FOODS.cp.unit.g
        if (bags > L.cpBags) warn.push(`今天 CP 会到 ${bags} 袋（钠约 ${fmt(bags * 310)}mg，建议 ≤ ${L.cpBags} 袋）`)
      }
      const gain = sumItems(main)
      return { key, items, main: label(main), side: side && label(side), gain: { p: gain.p, kcal: gain.kcal }, after: a, warn }
    })
    // 不会超标的排前面；其中吃完热量能到底线的再往前
    const clean = options.filter(o => !o.warn.length).sort((a, b) => (b.after.kcal >= L.kcalFloor) - (a.after.kcal >= L.kcalFloor))
    const shown = [...clean, ...options.filter(o => o.warn.length)].slice(0, Math.max(4, clean.length))
    return {
      status: 'protein', over, need: { p: remP, kcal: Math.max(0, L.kcalFloor - t.kcal) }, options: shown,
      note: remP > mealMax ? `这一顿先补 ${mealMax}g，剩下的 ${r1(remP - mealMax)}g 下一顿再补（每顿 ≥ 40g）` : '',
    }
  }
  if (t.kcal < L.kcalFloor) {
    const options = KCAL_ADDONS.map(items => {
      const a = after(t, items), gain = sumItems(items)
      return { key: items[0][0], items, main: label(items), side: null, gain: { p: gain.p, kcal: gain.kcal }, after: a, warn: newOvers(t, a, L) }
    })
    return { status: 'kcal', over, need: { p: 0, kcal: L.kcalFloor - t.kcal }, options }
  }
  return { status: over.length ? 'over' : 'done', over, options: [] }
}
