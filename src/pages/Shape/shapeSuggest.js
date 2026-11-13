// 首页「今天还差多少」：已吃 vs 目标的差额，以及「再吃什么」的具体建议
// （哪种蛋白吃多少克、配多少主食和菜、吃完全天各项是多少、会不会超）。
// 2026-11-13 起不再生酮：碳水有下限（不够就配主食），肉和鱼一天合计约一份（额度用完就用豆腐、蛋、酸奶补）。
// 同日加入蛋白粉：每天 2 勺（每顿 1 勺）。主蛋白封顶后还差的蛋白，今天还没喝满 2 勺就先用 1 勺补，喝满了才加豆腐。
// 纯计算，ShapePage 只呈现；npm run test:shape 覆盖（shapeSuggest.test.mjs）。
import { SHAPE_PLAN } from './shapePlan.js'
import { RECIPE_FOODS, sumItems, amountLabel } from './shapeRecipe.js'
import { splitItems, imagesFor } from './mealImages.js'

// 每日目标 → 建议算法用的上下限。看生酮期的旧日子时传 targetsFor(day)
export const limitsFrom = d => ({
  protein: d.protein,              // 下限
  kcalFloor: d.kcalFloor,          // 底线
  kcalCap: d.kcal,                 // 上限参考
  fat: d.fat,                      // 上限
  fatMin: d.fatMin,                // 下限
  satFat: d.satFat,                // 上限
  netCarb: d.netCarb,              // 上限
  netCarbMin: d.netCarbMin || 0,   // 下限
  steps: d.steps,                  // 下限
  sodiumMax: d.sodiumMax,          // 钠上限（mg）
  fleshMax: d.fleshMax,            // 肉 + 鱼一天合计（生重 g）
  cpBags: 3,                       // CP 一天 ≤ 3 袋（每袋钠 310mg，3 袋就把肉鱼额度用完了）
})
export const LIMITS = limitsFrom(SHAPE_PLAN.daily)
export const MEAL_MAX_PROTEIN = 70 // 一天两顿：一顿最多按 70g 蛋白建议，剩下的下一顿再补
export const MAIN_MEAL_PROTEIN = 40 // 热量还不到底线时，正餐至少按 40g 蛋白建议（差得少也吃一顿像样的）
export const WHEY_DAILY = 2         // 蛋白粉一天 2 勺、每顿 1 勺；喝满了就不再往建议里放（一条建议里最多 1 勺）

// 补蛋白的候选：主蛋白按需要的克数算、封顶 max；封顶后还差 ≥ 10g 的：今天没喝过蛋白粉先加 1 勺，
// 喝过了就用 top（肉和鱼没写 top，用豆腐）
const PROTEIN_OPTIONS = [
  { key: 'chickenBreast', max: 250 },
  { key: 'seabass', max: 250 },
  { key: 'tofu', max: 300, top: ['greekYogurt', 200] },
  { key: 'cp', max: 240 },
  { key: 'mackerel', max: 165 },
  { key: 'whey', max: 30, top: ['greekYogurt', 250] },
]
// 蛋白够了、热量不到底线时加的东西：碳水还没到下限先给主食和水果，否则给菜、牛油果、坚果
const CARB_ADDONS = [[['rice', 150]], [['sweetPotato', 200]], [['banana', 100], ['greekYogurt', 150]], [['oats', 40], ['greekYogurt', 150]]]
const KCAL_ADDONS = [[['choySum', 200], ['oliveOil', 10]], [['avocado', 70]], [['macadamia', 20]], [['banana', 100]]]
// 主食配完热量仍低于底线时：先试「菜 + 油」，会超就只加菜或只淋油，最后再试一根香蕉
const SIDES = [[['choySum', 200], ['oliveOil', 10]], [['choySum', 200]], [['oliveOil', 10]]]
const FRUIT = [['banana', 100]]
// 每天 20g 夏威夷果：今天还没吃坚果、热量又不到底线时放进这一顿
const NUTS = [['macadamia', 20]]
// 加了一样热量仍差得多时，再往上叠的小东西（按顺序试，不会超才加）
const EXTRAS = [['banana', 100], ['greekYogurt', 150], ['macadamia', 20]]

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

// 今天大约吃了多少克肉和鱼（从记录文字估）：CP 按袋 × 80g、青花鱼按片 × 165g，其余认「…300g」，
// 没写克数的按一份 120g。只用来决定「这顿还给不给肉 / 鱼」，不是精确数字。
const FLESH_EXTRA = /猪|五花|排骨|培根|火腿|香肠|羊|鸭肉|烤鸭|鹅|鸡腿|鸡翅|鸡肉|鱼|蟹|贝|蛤|蚝|鱿|内脏|肝|肥牛/
export function fleshEaten(foodRows) {
  let g = 0
  for (const r of foodRows) for (const it of splitItems(r.items)) {
    const text = it.text
    if (/蛋|豆腐|鱼油|鱼露|用油/.test(text)) continue
    const keys = imagesFor(text, 9)
    const flesh = keys.some(k => RECIPE_FOODS[k]?.flesh || k === 'friedChicken') || FLESH_EXTRA.test(text)
    if (!flesh) continue
    const bags = keys.includes('cp') && text.match(/(\d+)\s*袋/)
    const pieces = keys.includes('mackerel') && text.match(/(\d+)\s*片/)
    const grams = text.match(/(\d+)\s*g/i)
    g += bags ? Number(bags[1]) * 80 : grams ? Number(grams[1]) : pieces ? Number(pieces[1]) * 165 : 120
  }
  return g
}

// 今天吃过坚果没有（每天 20g 夏威夷果，吃过了建议里就不再放）
export const ateNuts = foodRows => foodRows.some(r => /夏威夷果|坚果|巴旦木|杏仁|核桃|腰果|开心果/.test(String(r.items || '')))

// 今天喝了几勺蛋白粉（从 items 文字里认「蛋白粉 1 勺」；没写勺数的按 1 勺）
export function wheyScoopsEaten(foodRows) {
  let n = 0
  for (const r of foodRows) for (const it of splitItems(r.items)) {
    if (!/蛋白粉|乳清/.test(it.text)) continue
    const m = it.text.match(/(\d+(?:\.\d+)?)\s*勺/)
    n += m ? Number(m[1]) : /半勺/.test(it.text) ? 0.5 : 1
  }
  return n
}

// 补够 targetP 克蛋白要吃多少：按袋/片/勺的取整数，按克的向上取整到 10g；都不超过 max
export function amountFor(key, targetP, max = Infinity) {
  const x = RECIPE_FOODS[key]
  if (x.unit) {
    const per = x.p * x.unit.g / 100
    const n = Math.max(1, Math.ceil((targetP - 1) / per))
    return Math.min(n * x.unit.g, Math.max(x.unit.g, Math.floor(max / x.unit.g) * x.unit.g))
  }
  return Math.min(Math.floor(max / 10) * 10, Math.max(50, Math.ceil(targetP / x.p * 100 / 10) * 10))
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
  if (a.c > L.netCarb && t.c <= L.netCarb) w.push(`碳水会到 ${a.c}g（上限 ${L.netCarb}）`)
  if (a.kcal > L.kcalCap && t.kcal <= L.kcalCap) w.push(`热量会到 ${fmt(a.kcal)}（上限 ${fmt(L.kcalCap)}）`)
  return w
}

// 已经超了的项，配菜不能再往上加（比如碳水已满，就不再配主食）
function worsensOver(t, items, L) {
  const g = sumItems(items)
  return (t.c > L.netCarb && g.c > 0.5) || (t.sfa > L.satFat && g.sfa > 0.5) || (t.f > L.fat && g.f > 0.5)
}

// 建议里的名字去掉括号备注（「糙米饭（熟）」→「糙米饭」），一行能读完
const shortName = k => RECIPE_FOODS[k].name.replace(/（[^）]*）/g, '')
const label = items => items.map(([k, g]) => `${shortName(k)} ${amountLabel(k, g)}`).join(' + ')
const fits = (t, items, L) => !newOvers(t, after(t, items), L).length && !worsensOver(t, items, L)

// 一个候选：主蛋白（封顶）+ 补足的蛋白 + 主食（碳水不到下限时）+ 菜和油、水果、夏威夷果（热量不到底线时）
function buildOption(opt, t, thisMeal, { cpEaten, fleshLeft, wheyLeft, nutsLeft, L }) {
  const x = RECIPE_FOODS[opt.key]
  if (opt.key === 'whey' && !wheyLeft) return null // 今天的蛋白粉喝满了
  const max = x.flesh ? Math.min(opt.max, fleshLeft) : opt.max
  if (x.flesh && max < (x.unit ? x.unit.g : 80)) return null // 肉鱼额度用完了，这个候选不给
  const main = [[opt.key, amountFor(opt.key, thisMeal, max)]]
  let rest = thisMeal - sumItems(main).p
  const top = wheyLeft && opt.key !== 'whey' ? ['whey', RECIPE_FOODS.whey.unit.g] : opt.top
  if (top && rest >= 10) {
    main.push(top)
    rest = thisMeal - sumItems(main).p
  }
  if (!opt.top && rest >= 10) main.push(['tofu', Math.min(300, Math.max(100, Math.ceil(rest / RECIPE_FOODS.tofu.p * 100 / 50) * 50))])

  const side = []
  const carbGap = L.netCarbMin - after(t, main).c
  if (carbGap > 10) {
    const want = Math.min(200, Math.max(100, Math.ceil(carbGap / RECIPE_FOODS.rice.c * 100 / 50) * 50))
    const g = [want, 150, 100].find(v => v <= want && fits(t, [...main, ['rice', v]], L))
    if (g) side.push(['rice', g])
  }
  if (after(t, [...main, ...side]).kcal < L.kcalFloor) {
    const s = SIDES.find(s => fits(t, [...main, ...side, ...s], L))
    if (s) side.push(...s)
  }
  if (after(t, [...main, ...side]).kcal < L.kcalFloor && fits(t, [...main, ...side, ...FRUIT], L)) side.push(...FRUIT)
  if (nutsLeft && after(t, [...main, ...side]).kcal < L.kcalFloor && fits(t, [...main, ...side, ...NUTS], L)) side.push(...NUTS)
  // 还差 50 kcal 以上：主食加到 200g
  const riceAt = side.findIndex(([k]) => k === 'rice')
  if (riceAt >= 0 && side[riceAt][1] < 200 && after(t, [...main, ...side]).kcal < L.kcalFloor - 50) {
    const more = side.map((s, i) => (i === riceAt ? ['rice', 200] : s))
    if (fits(t, [...main, ...more], L)) side.splice(0, side.length, ...more)
  }

  const items = [...main, ...side]
  const a = after(t, items)
  const warn = newOvers(t, a, L)
  const mainG = sumItems(main)
  if (t.c > L.netCarb && mainG.c > 0.5) warn.push(`碳水已经超了，这个还会再加 ${mainG.c}g`)
  if (t.sfa > L.satFat && mainG.sfa > 0.5) warn.push(`饱和脂肪已经超了，这个还会再加 ${mainG.sfa}g`)
  if (opt.key === 'cp') {
    const bags = cpEaten + main[0][1] / x.unit.g
    if (bags > L.cpBags) warn.push(`今天 CP 会到 ${bags} 袋（钠约 ${fmt(bags * 310)}mg，建议 ≤ ${L.cpBags} 袋）`)
  }
  return { key: opt.key, flesh: !!x.flesh, items, main: label(main), side: side.length ? label(side) : null, gain: { p: mainG.p, kcal: mainG.kcal }, after: a, warn }
}

// 主函数。status：empty 还没记录 / protein 蛋白不够 / kcal 蛋白够了热量不够 / done 全部达标 / over 已经超了
// low：吃得偏少、但今天已经没法再补的项（碳水、脂肪），只用来提醒明天
// fleshEaten：今天已经吃了多少克肉和鱼（不传就不限制）；wheyEaten：今天喝了几勺蛋白粉；nutsEaten：今天吃过坚果没有
export function suggest(totals, { cpEaten = 0, fleshEaten: eaten = null, wheyEaten = 0, nutsEaten = false, mealMax = MEAL_MAX_PROTEIN, L = LIMITS } = {}) {
  const t = norm(totals)
  const over = []
  if (t.kcal > L.kcalCap) over.push('热量')
  if (t.f > L.fat) over.push('脂肪')
  if (t.sfa > L.satFat) over.push('饱和脂肪')
  if (t.c > L.netCarb) over.push('碳水')
  if (!t.kcal) return { status: 'empty', over, low: [], lowTip: '', options: [] }
  const low = [], tips = []
  if (t.c < L.netCarbMin) { low.push(`碳水 ${r1(t.c)}g（目标 ${L.netCarbMin}–${L.netCarb}g）`); tips.push('每顿带一份主食') }
  if (t.f < L.fatMin) { low.push(`脂肪 ${r1(t.f)}g（目标 ${L.fatMin}–${L.fat}g）`); tips.push('菜上淋一勺橄榄油') }
  const lowTip = tips.length ? `明天${tips.join('、')}` : ''
  const fleshLeft = eaten == null || !L.fleshMax ? Infinity : Math.max(0, L.fleshMax - eaten)
  const wheyLeft = wheyEaten < WHEY_DAILY
  const nutsLeft = !nutsEaten && L.netCarbMin > 0 // 生酮期的旧日子不往回加
  const noNuts = items => nutsLeft || !items.some(([k]) => k === 'macadamia')

  const remP = r1(L.protein - t.p)
  if (remP > 0) {
    const thisMeal = t.kcal < L.kcalFloor && remP < MAIN_MEAL_PROTEIN ? MAIN_MEAL_PROTEIN : Math.min(remP, mealMax)
    const options = PROTEIN_OPTIONS.map(o => buildOption(o, t, thisMeal, { cpEaten, fleshLeft, wheyLeft, nutsLeft, L })).filter(Boolean)
    // 不会超标的排前面；其中吃完热量能到底线（差 50 以内也算）的再往前
    const near = o => o.after.kcal >= L.kcalFloor - 50
    const clean = options.filter(o => !o.warn.length).sort((a, b) => near(b) - near(a))
    const shown = [...clean, ...options.filter(o => o.warn.length)].slice(0, Math.max(4, clean.length))
    const notes = []
    if (remP > mealMax) notes.push(`这一顿先补 ${mealMax}g，剩下的 ${r1(remP - mealMax)}g 下一顿再补（每顿 ≥ 40g）`)
    if (fleshLeft < 80) notes.push(`今天的肉和鱼已经够一份了，这顿用豆腐、蛋、酸奶${wheyLeft ? '、蛋白粉' : ''}补`)
    return { status: 'protein', over, low, lowTip, need: { p: remP, kcal: Math.max(0, L.kcalFloor - t.kcal) }, options: shown, note: notes.join('；'), fleshUsed: fleshLeft < 80 }
  }
  if (t.kcal < L.kcalFloor) {
    const options = (t.c < L.netCarbMin ? CARB_ADDONS : KCAL_ADDONS).filter(noNuts).map(base => {
      const items = [...base]
      for (const e of EXTRAS.filter(e => noNuts([e]))) {
        if (after(t, items).kcal >= L.kcalFloor - 50) break
        if (!items.some(([k]) => k === e[0]) && fits(t, [...items, e], L)) items.push(e)
      }
      const a = after(t, items), gain = sumItems(items)
      return { key: items[0][0], flesh: false, items, main: label(items), side: null, gain: { p: gain.p, kcal: gain.kcal }, after: a, warn: newOvers(t, a, L) }
    })
    return { status: 'kcal', over, low, lowTip, need: { p: 0, kcal: L.kcalFloor - t.kcal }, options }
  }
  return { status: over.length ? 'over' : 'done', over, low, lowTip, options: [] }
}
