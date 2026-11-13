// 塑形食谱：一日基线 + 一周食谱 + 蛋白替换表 + 问答。纯数据 + 纯计算，RecipePage 只负责呈现。
// 2026-11-13 起不再生酮：一天两顿（约 12:00、18:30），每顿一份主食；肉和鱼一天合计约一份，其余蛋白用蛋白粉（每天 2 勺，每顿 1 勺）、蛋、豆腐、酸奶补；每天夏威夷果 20g。
// 营养数值按每 100g 可食部分（肉鱼菜是生重，米饭、鹰嘴豆是熟重）：大部分取自 lib/ketoPlan.js 的 FOODS；CP 按包装标签换算；
// 青花鱼、蛋清、主食、水果、豆类和全部饱和脂肪（sfa）取 USDA 近似值。改克数后跑 npm run test:shape——
// 每一天都必须满足 RECIPE_TARGETS（热量、蛋白、碳水区间、脂肪区间、饱和脂肪、鸡蛋个数、肉鱼总量），否则测试失败。
import { FOODS } from '../../lib/ketoPlan.js'
import { SHAPE_PLAN } from './shapePlan.js'

const t = SHAPE_PLAN.daily
export const RECIPE_TARGETS = {
  kcal: [1650, 1950],      // 目标约 1,750；不低于 1,600 是底线，这里留余量
  protein: t.protein,      // ≥ 130g
  netCarb: t.netCarb,      // ≤ 130g
  netCarbMin: t.netCarbMin, // ≥ 80g
  fat: t.fat,              // ≤ 90g
  fatMin: t.fatMin,        // ≥ 60g
  satFat: t.satFat,        // ≤ 15g
  eggsMax: 3,              // 全蛋每天 ≤ 3 个
  fleshMax: t.fleshMax,    // 肉 + 鱼一天合计生重 ≤ 250g（CP 也算）
  mealProtein: 50,         // 两顿每顿 ≥ 50g
}

const base = (k, extra) => ({ ...FOODS[k], ...extra })

// kind：protein 蛋白 / carb 主食和水果 / veg 蔬菜 / fat 脂肪坚果。flesh：肉、鱼、禽（算进每天一份的额度）。
// unit：按个、袋计数的食物（g = 每个/每袋克数）
export const RECIPE_FOODS = {
  cp: { name: 'CP 打抛嫩鸡胸', kind: 'protein', flesh: true, kcal: 112.5, p: 22.5, f: 1.875, c: 1.25, sfa: 0, unit: { label: '袋', g: 80 }, note: '7-11 อกไก่นุ่มกะเพรา，标签每袋 90kcal / 蛋白 18g / 钠 310mg' },
  egg: base('egg', { kind: 'protein', sfa: 3.1, unit: { label: '个', g: 50 } }),
  eggWhite: { name: '蛋清', kind: 'protein', kcal: 52, p: 10.9, f: 0.2, c: 0.7, sfa: 0, unit: { label: '个', g: 33 } },
  tofu: base('tofu', { kind: 'protein', sfa: 0.7 }),
  // 选无糖、低脂的（plain / 2% fat）；全脂的每 100g 饱和脂肪约 3g，一天 200g 就占掉近一半额度
  greekYogurt: { name: '无糖希腊酸奶（低脂）', kind: 'protein', kcal: 73, p: 9.9, f: 1.9, c: 3.9, sfa: 1.2 },
  edamame: { name: '毛豆仁', kind: 'protein', kcal: 121, p: 11.9, f: 5.2, c: 3.7, sfa: 0.6 },
  // 2026-11-13 起每天固定 2 勺（每顿 1 勺）。数值先按一般乳清浓缩蛋白估（1 勺 30g：120 kcal / 蛋白 24g），拿到那罐的标签后改这一行
  whey: { name: '乳清蛋白粉', kind: 'protein', kcal: 400, p: 80, f: 6, c: 8, sfa: 3, unit: { label: '勺', g: 30 }, note: '1 勺约 30g：120 kcal / 蛋白 24g（按一般乳清粉估，以自己那罐的标签为准）' },
  chickenBreast: base('chickenBreast', { name: '生鸡胸肉', kind: 'protein', flesh: true, sfa: 0.6 }),
  shrimp: base('shrimp', { kind: 'protein', flesh: true, sfa: 0.1 }),
  seabass: base('seabass', { kind: 'protein', flesh: true, sfa: 0.8 }),
  // 标品：挪威青花鱼片（CP Axtra 进口，800g/包，每片 140–190g，配料只有鱼、未加盐）。包装无营养表，按 USDA 大西洋青花鱼生重。
  mackerel: { name: '挪威青花鱼片', kind: 'protein', flesh: true, kcal: 205, p: 18.6, f: 13.9, c: 0, sfa: 3.26, unit: { label: '片', g: 165 }, note: '1 片约 165g：338kcal / 蛋白 31g / 脂肪 23g（饱和 5.4g、EPA+DHA 3.8g）' },
  salmon: base('salmon', { kind: 'protein', flesh: true, sfa: 3.05 }),
  beefLean: base('beefLean', { name: '瘦牛肉', kind: 'protein', flesh: true, sfa: 1.8 }),
  rice: { name: '糙米饭（熟）', kind: 'carb', kcal: 123, p: 2.7, f: 1, c: 24, sfa: 0.3, note: 'riceberry / ข้าวกล้อง 都行；150g 约一小碗' },
  oats: { name: '燕麦片', kind: 'carb', kcal: 379, p: 13.2, f: 6.5, c: 57.6, sfa: 1.1 },
  sweetPotato: { name: '红薯', kind: 'carb', kcal: 86, p: 1.6, f: 0.1, c: 17.1, sfa: 0.02 },
  chickpea: { name: '鹰嘴豆（熟）', kind: 'carb', kcal: 164, p: 8.9, f: 2.6, c: 19.8, sfa: 0.27 },
  banana: { name: '香蕉', kind: 'carb', kcal: 89, p: 1.1, f: 0.3, c: 20.2, sfa: 0.11, unit: { label: '根', g: 100 } },
  guava: { name: '芭乐', kind: 'carb', kcal: 68, p: 2.6, f: 1, c: 8.9, sfa: 0.27 },
  choySum: base('choySum', { kind: 'veg', sfa: 0.1 }),
  broccoli: base('broccoli', { kind: 'veg', sfa: 0.04 }),
  cauliflower: base('cauliflower', { kind: 'veg', sfa: 0.13 }),
  cabbage: base('cabbage', { kind: 'veg', sfa: 0.03 }),
  zucchini: base('zucchini', { kind: 'veg', sfa: 0.08 }),
  asparagus: base('asparagus', { kind: 'veg', sfa: 0.04 }),
  mushroom: base('mushroom', { kind: 'veg', sfa: 0.05 }),
  lettuce: base('lettuce', { kind: 'veg', sfa: 0.03 }),
  cucumber: base('cucumber', { kind: 'veg', sfa: 0.04 }),
  tomato: base('tomato', { kind: 'veg', sfa: 0.03 }),
  greenPepper: base('greenPepper', { kind: 'veg', sfa: 0.06 }),
  avocado: base('avocado', { name: '牛油果', kind: 'fat', sfa: 2.1, unit: { label: '个', g: 140 } }), // 克数都是果肉
  oliveOil: base('oliveOil', { kind: 'fat', sfa: 13.8 }),
  almond: base('almond', { kind: 'fat', sfa: 3.8 }),
  walnut: base('walnut', { kind: 'fat', sfa: 6.1 }),
  // 2026-11-13 起每天 20g（约 8–10 颗）。USDA 生夏威夷果：脂肪 76g 里约 59g 是单不饱和、12g 是饱和；c 是净碳水
  macadamia: { name: '夏威夷果', kind: 'fat', kcal: 718, p: 7.9, f: 75.8, c: 5.2, sfa: 12.1, note: '20g 约 8–10 颗：144 kcal / 脂肪 15g（饱和 2.4g）；买原味、不加盐不裹糖的' },
  pumpkinSeed: base('pumpkinSeed', { kind: 'fat', sfa: 8.7 }),
}

const r1 = v => Math.round(v * 10) / 10

export function itemNutrition(key, g) {
  const x = RECIPE_FOODS[key]
  if (!x) throw new Error(`未知食物：${key}`)
  const k = g / 100
  return { kcal: x.kcal * k, p: x.p * k, f: x.f * k, sfa: x.sfa * k, c: x.c * k }
}

export function sumItems(items) {
  const s = { kcal: 0, p: 0, f: 0, sfa: 0, c: 0 }
  for (const [key, g] of items) {
    const n = itemNutrition(key, g)
    for (const k in s) s[k] += n[k]
  }
  return { kcal: Math.round(s.kcal), p: r1(s.p), f: r1(s.f), sfa: r1(s.sfa), c: r1(s.c) }
}

export const dayItems = day => day.meals.flatMap(m => m.items)
export const dayTotals = day => sumItems(dayItems(day))
export const eggCount = day => dayItems(day).filter(([k]) => k === 'egg').reduce((a, [, g]) => a + g / RECIPE_FOODS.egg.unit.g, 0)
// 一天的肉 + 鱼（生重 g）
export const fleshGrams = day => dayItems(day).filter(([k]) => RECIPE_FOODS[k].flesh).reduce((a, [, g]) => a + g, 0)

// 「3 个（150g）」「1 袋（80g）」「半个（70g）」「200g」
export function amountLabel(key, g) {
  const u = RECIPE_FOODS[key]?.unit
  if (!u) return `${g}g`
  const n = g / u.g
  if (key === 'avocado') return n === 0.5 ? `半个（${g}g 果肉）` : n === 1 ? `1 个（${g}g 果肉）` : `${g}g 果肉`
  return Number.isInteger(n) ? `${n} ${u.label}（${g}g）` : `${g}g`
}

// 每天各项是否达标；正餐（不含加餐）每顿蛋白 ≥ 50g
export function dayChecks(day, T = RECIPE_TARGETS) {
  const s = dayTotals(day)
  const mains = day.meals.filter(m => m.slot !== 'snack').map(m => sumItems(m.items).p)
  return {
    kcal: s.kcal >= T.kcal[0] && s.kcal <= T.kcal[1],
    protein: s.p >= T.protein,
    netCarb: s.c <= T.netCarb && s.c >= T.netCarbMin,
    fat: s.f <= T.fat && s.f >= T.fatMin,
    satFat: s.sfa <= T.satFat,
    eggs: eggCount(day) <= T.eggsMax,
    flesh: fleshGrams(day) <= T.fleshMax,
    mealProtein: mains.every(p => p >= T.mealProtein),
  }
}

// 一周采购：同一食物克数相加；按个/袋的换算成个数（向上取整）
const KIND_ORDER = ['protein', 'carb', 'veg', 'fat']
export function shoppingList(days) {
  const m = new Map()
  for (const d of days) for (const [k, g] of dayItems(d)) m.set(k, (m.get(k) || 0) + g)
  return [...m.entries()].map(([key, g]) => {
    const u = RECIPE_FOODS[key].unit
    return { key, g, label: u ? `${Math.ceil(g / u.g)} ${u.label}（${g}g）` : g >= 1000 ? `${r1(g / 1000)}kg` : `${g}g` }
  }).sort((a, b) => KIND_ORDER.indexOf(RECIPE_FOODS[a.key].kind) - KIND_ORDER.indexOf(RECIPE_FOODS[b.key].kind) || b.g - a.g)
}


// ── 蛋白替换：1 份 = 18g 蛋白 = 1 袋 CP ──
// tag「肉鱼」的算进每天一份（生重合计 ≤ 250g）的额度，其余不限
export const PROTEIN_UNIT = 18
export const PROTEIN_SWAPS = [
  { key: 'tofu', g: 150, tag: '不限', tip: '半盒；豆制品不升尿酸，放心吃' },
  { key: 'greekYogurt', g: 180, tag: '不限', tip: '选无糖、低脂或 0 脂；低脂奶有助于排尿酸' },
  { key: 'eggWhite', g: 165, tag: '不限', tip: '5 个蛋清；想多吃蛋就加蛋清' },
  { key: 'egg', g: 150, tag: '不限', tip: '全蛋每天 ≤ 3 个（饱和脂肪）' },
  { key: 'whey', g: 23, tag: '不限', tip: '约 3/4 勺；每天固定 2 勺（每顿 1 勺，共 ≈ 2.7 份），冷水冲或拌酸奶' },
  { key: 'edamame', g: 150, tag: '不限', tip: '7-11 有带壳的，净豆约占一半重量' },
  { key: 'cp', g: 80, tag: '肉鱼', tip: '一天 ≤ 3 袋，而且算进肉鱼额度' },
  { key: 'chickenBreast', g: 80, tag: '肉鱼', tip: '生重；空气炸锅最省事' },
  { key: 'seabass', g: 100, tag: '肉鱼', tip: '清蒸、盐烤都行' },
  { key: 'mackerel', g: 100, tag: '肉鱼', tip: '1 片 165g ≈ 1.7 份；自带 23g 脂肪，当天少放油' },
  { key: 'salmon', g: 90, tag: '肉鱼', tip: 'omega-3 多；饱和脂肪也不少，一次 150g 左右' },
  { key: 'beefLean', g: 85, tag: '肉鱼', tip: '红肉一周 1–2 次，选瘦的部位' },
]

// ── 一周食谱：一天两顿。周一就是基线日，其余按同一结构换蛋白、主食和蔬菜 ──
// brief：吃饭提醒里用的一句话版本（meal-reminder-core.mjs 直接读它，和这里的克数保持一致）
const SCOOP = '蛋白粉 1 勺用 250ml 冷水或温水摇匀，随饭喝'
const FIRST = (veg, g = 200, { rice = 150, oil = 10 } = {}) => {
  const v = RECIPE_FOODS[veg].name
  return {
    slot: 'first', time: '12:00', name: `炒蛋 + CP 鸡胸 + 糙米饭 + ${v} + 蛋白粉`,
    brief: `炒蛋 2 个 + CP 1 袋 + 糙米饭${rice === 150 ? ' 1 小碗（150g）' : ` ${rice}g`}+ ${v} + 蛋白粉 1 勺`,
    how: `${oil}g 橄榄油炒${v}，打入 2 个蛋炒熟（不开火就买 2 个水煮蛋，油淋在菜上）。CP 鸡胸撕开直接吃。糙米饭 ${rice}g 是熟重${rice === 150 ? '，约一小碗' : ''}：7-11 的即食糙米饭 / 紫米饭让店员微波一下就行，只有白米饭就少吃三分之一。${SCOOP}。`,
    items: [['egg', 100], ['cp', 80], ['whey', 30], ['rice', rice], [veg, g], ['oliveOil', oil]],
  }
}
const OATS = (fruit, fruitG, fruitText, yogurt = 150) => ({
  slot: 'first', time: '12:00', name: '燕麦蛋白酸奶碗 + 水煮蛋 2 个 + 夏威夷果',
  brief: `燕麦 50g + 酸奶 ${yogurt}g + 蛋白粉 1 勺 + ${fruitText} + 水煮蛋 2 个 + 夏威夷果 20g`,
  how: `不用开火：燕麦片 50g 用热水泡 3 分钟，放到不烫手后拌入 ${yogurt}g 酸奶和 1 勺蛋白粉，${fruitText}切块、夏威夷果 20g（约 8–10 颗）放在上面。水煮蛋 2 个（7-11 有现成的）。`,
  items: [['oats', 50], ['greekYogurt', yogurt], ['whey', 30], [fruit, fruitG], ['egg', 100], ['macadamia', 20]],
})

export const BASELINE_DAY = {
  day: '周一', theme: '基线日',
  meals: [
    FIRST('choySum'),
    {
      slot: 'second', time: '18:30', name: '空气炸锅鸡胸 + 红薯 + 西兰花蘑菇 + 蛋白粉香蕉 + 夏威夷果',
      brief: '鸡胸 170g + 红薯 250g + 西兰花蘑菇 + 蛋白粉 1 勺 + 香蕉 1 根 + 夏威夷果 20g',
      how: '鸡胸 170g 片成两片，盐、黑胡椒、蒜粉腌 15 分钟，喷 5g 油，200°C 空气炸 12–14 分钟，中途翻面，切开不粉红就熟了。红薯洗净带皮切块，一起进空气炸锅 180°C 20 分钟（或直接买 7-11 的烤红薯，一个大的约 250g）。西兰花、蘑菇水开焯 1–2 分钟，淋 10g 橄榄油、少许酱油、蒜末。' + SCOOP + '；饭后香蕉 1 根、夏威夷果 20g（约 8–10 颗）。',
      items: [['chickenBreast', 170], ['sweetPotato', 250], ['broccoli', 200], ['mushroom', 100], ['oliveOil', 15], ['whey', 30], ['banana', 100], ['macadamia', 20]],
    },
  ],
}

export const WEEK = [
  BASELINE_DAY,
  {
    day: '周二', theme: '青花鱼日',
    meals: [
      FIRST('asparagus', 150, { rice: 200, oil: 5 }),
      {
        slot: 'second', time: '18:30', name: '空气炸锅青花鱼 + 红薯 + 西兰花蘑菇 + 蛋白粉 + 芭乐 + 夏威夷果',
        brief: '青花鱼 1 片 + 红薯 250g + 西兰花蘑菇 + 蛋白粉 1 勺 + 芭乐半个 + 夏威夷果 20g',
        how: '青花鱼 1 片冷藏解冻，撕掉肚子内侧的黑膜、冲掉血水，两面撒盐静置 10 分钟，再用厨房纸把渗出的水彻底擦干（去腥关键）；撒黑胡椒、姜丝，皮朝上 200°C 空气炸 10–12 分钟，不用放油（冷冻直接烤 15–18 分钟；中线有细刺），出锅挤青柠。红薯做法同周一。西兰花、蘑菇水开焯 1–2 分钟，淋少许酱油、蒜末，不另外放油（鱼自带 23g 脂肪，今天全天的油只用 5g）。' + SCOOP + '；饭后芭乐半个（约 150g，不蘸糖）、夏威夷果 20g。',
        items: [['mackerel', 165], ['sweetPotato', 250], ['broccoli', 200], ['mushroom', 100], ['whey', 30], ['guava', 150], ['macadamia', 20]],
      },
    ],
  },
  {
    day: '周三', theme: '鸡胸日',
    meals: [
      OATS('banana', 100, '香蕉 1 根'),
      {
        slot: 'second', time: '18:30', name: '空气炸锅鸡胸 + 糙米饭 + 包菜炒番茄 + 蛋白粉',
        brief: '鸡胸 250g + 糙米饭 200g + 包菜炒番茄 + 蛋白粉 1 勺',
        how: '鸡胸片成两片，盐、黑胡椒、蒜粉腌 15 分钟，喷 5g 油，200°C 空气炸 12–14 分钟，中途翻面。包菜手撕、番茄切块，15g 橄榄油大火炒 3 分钟（不开火就做成生菜番茄沙拉，油直接淋上去）。配糙米饭 200g。' + SCOOP + '。',
        items: [['chickenBreast', 250], ['rice', 200], ['cabbage', 200], ['tomato', 100], ['oliveOil', 20], ['whey', 30]],
      },
    ],
  },
  {
    day: '周四', theme: '豆腐日',
    meals: [
      {
        slot: 'first', time: '12:00', name: '家常豆腐炒蛋 + 糙米饭 + 菜心蘑菇 + 蛋白粉',
        brief: '豆腐 1 盒（300g）+ 蛋 2 个 + 糙米饭 150g + 菜心蘑菇 + 蛋白粉 1 勺',
        how: '豆腐切块，10g 橄榄油煎到两面金黄盛出；锅里再放 5g 油炒香蒜末，下蘑菇、菜心炒 2 分钟，打入 2 个蛋，豆腐回锅，少许酱油、黑胡椒调味。配糙米饭 150g。' + SCOOP + '。今天全天不吃肉和鱼，蛋白靠豆腐、蛋、毛豆和蛋白粉；豆腐（เต้าหู้แข็ง / เต้าหู้ขาว）在 Tops、Big C、Lotus’s 的冷藏柜，买不到就照周一吃。',
        items: [['tofu', 300], ['egg', 100], ['rice', 150], ['choySum', 200], ['mushroom', 100], ['oliveOil', 15], ['whey', 30]],
      },
      {
        slot: 'second', time: '18:30', name: '毛豆鹰嘴豆沙拉 + 蛋白粉香蕉 + 夏威夷果',
        brief: '毛豆仁 150g + 鹰嘴豆 100g + 生菜黄瓜番茄 + 蛋白粉 1 勺 + 香蕉 1 根 + 夏威夷果 20g',
        how: '毛豆仁（冷冻的焯 3 分钟）、鹰嘴豆（罐头的冲水沥干）、生菜、黄瓜、番茄拌在一起，淋 5g 橄榄油 + 青柠汁 + 盐 + 黑胡椒，夏威夷果 20g 掰碎撒上去。' + SCOOP + '；饭后香蕉 1 根。',
        items: [['edamame', 150], ['chickpea', 100], ['lettuce', 100], ['cucumber', 150], ['tomato', 100], ['oliveOil', 5], ['whey', 30], ['banana', 100], ['macadamia', 20]],
      },
    ],
  },
  {
    day: '周五', theme: '清蒸鱼日',
    meals: [
      OATS('guava', 200, '芭乐大半个（200g）', 100),
      {
        slot: 'second', time: '18:30', name: '泰式清蒸鲈鱼 + 糙米饭 + 白灼菜心 + 蛋白粉',
        brief: '鲈鱼净肉 250g + 糙米饭 250g + 菜心 + 蛋白粉 1 勺',
        how: '鲈鱼两面划刀，姜片垫底，水开蒸 8–10 分钟，倒掉蒸出的水，淋青柠汁、蒜末、辣椒和少许鱼露（不放糖），再淋 10g 橄榄油（不想蒸就撒盐和黑胡椒，200°C 空气炸 12 分钟）。菜心焯 1 分钟，淋 5g 油。配糙米饭 250g（一大碗）。' + SCOOP + '。',
        items: [['seabass', 250], ['rice', 250], ['choySum', 200], ['oliveOil', 15], ['whey', 30]],
      },
    ],
  },
  {
    day: '周六', theme: '牛肉日',
    meals: [
      FIRST('zucchini'),
      {
        slot: 'second', time: '18:30', name: '黑椒牛肉炒青椒蘑菇 + 红薯 + 毛豆 + 蛋白粉香蕉 + 夏威夷果',
        brief: '瘦牛肉 170g + 红薯 250g + 青椒蘑菇 + 毛豆仁 100g + 蛋白粉 1 勺 + 香蕉 1 根 + 夏威夷果 20g',
        how: '牛肉逆纹切片，黑胡椒、少许酱油腌 10 分钟；10g 橄榄油大火快炒 2 分钟盛出，再炒青椒蘑菇，回锅拌匀。红薯做法同周一。毛豆仁 100g（7-11 冷藏柜的带壳毛豆约 200g，剥着吃）。红肉一周就这一次，量按 170g。' + SCOOP + '；饭后香蕉 1 根、夏威夷果 20g。',
        items: [['beefLean', 170], ['sweetPotato', 250], ['greenPepper', 150], ['mushroom', 150], ['edamame', 100], ['oliveOil', 10], ['whey', 30], ['banana', 100], ['macadamia', 20]],
      },
    ],
  },
  {
    day: '周日', theme: '外食日',
    meals: [
      {
        slot: 'first', time: '12:00', name: '7-11 快手：CP 鸡胸 + 水煮蛋 + 酸奶 + 烤红薯 + 香蕉 + 蛋白粉',
        brief: '7-11：CP 1 袋 + 水煮蛋 2 个 + 无糖酸奶 150g + 烤红薯 150g + 香蕉 1 根 + 蛋白粉 1 勺 + 夏威夷果 20g',
        how: '全部 7-11 能买到：CP 鸡胸 1 袋、水煮蛋 2 个（ไข่ต้ม）、无糖酸奶 150g（看标签选 plain / ไม่มีน้ำตาล）、烤红薯半个约 150g（มันหวานเผา）、香蕉 1 根。蛋白粉 1 勺可以直接拌进酸奶，夏威夷果 20g 自己带。不买甜饮料和果汁。',
        items: [['cp', 80], ['egg', 100], ['greekYogurt', 150], ['whey', 30], ['sweetPotato', 150], ['banana', 100], ['macadamia', 20]],
      },
      {
        slot: 'second', time: '18:30', name: '泰餐馆：盐烤鱼 + 糙米饭 + 清炒菜心，回家蛋白粉',
        brief: '盐烤鱼净肉约 170g + 糙米饭 200g + 炒青菜 + 芭乐 + 蛋白粉 1 勺',
        how: '点 ปลาเผาเกลือ（盐烤鱼，吃约 170g 鱼肉、大概半条，不蘸甜酱）、ผัดผักกาดกวางตุ้ง（炒菜心，说 น้ำมันน้อย ไม่ใส่น้ำตาล：少油不放糖）、ข้าวกล้อง 1 份（糙米饭，没有就白饭吃大半碗）。不点虾蟹贝类和冬阴功。餐馆炒菜用油多，按 20g 算。饭后芭乐 100g，不蘸糖；回家冲 1 勺蛋白粉（20:00 前）。',
        items: [['seabass', 170], ['rice', 200], ['choySum', 200], ['oliveOil', 20], ['guava', 100], ['whey', 30]],
      },
    ],
  },
]

// ── 问答 ──
export const QA = [
  {
    group: '基线', items: [
      { q: '一天到底吃多少？', a: ['热量约 1,750 kcal（1,600–1,900 都行，最低别低于 1,600）。', '蛋白 ≥ 130g，两顿每顿 ≥ 50g。', '碳水 80–130g：每顿一份主食（糙米饭一小碗或红薯一个），再加 1–2 份水果。', '脂肪 60–90g，其中饱和脂肪 ≤ 15g。', '顺序：先把蛋白吃够 → 蔬菜吃够 → 一份主食 → 油和坚果补到不饿为止。'] },
      { q: '不生酮了，还能减脂吗？', a: ['能。减脂靠的是热量缺口，不靠酮症：同样的热量和蛋白，低碳和均衡吃法减掉的脂肪差不多。', '现在一天约 1,750 kcal，比消耗少 600–800 kcal，一周大约掉 0.5–0.8 公斤。', '别贪快：一周掉超过体重的 1%（约 0.9 公斤）会让尿酸升高、肌肉流失，这时每天加 100–200 kcal。'] },
      { q: '为什么是两顿？间隔多久？', a: ['进食窗口约 12:00–20:00（就是 16:8），两顿容易安排，每顿也吃得饱。', '两顿隔 4–6 小时都行：12:00 + 17:00，或 12:00 + 18:30。8 小时是上限，吃得早、窗口更短也没问题。', '窗口之外只喝水、黑咖啡、无糖茶。'] },
      { q: '能不能一天只吃一顿？', a: ['不建议。1,700 kcal + 130g 蛋白一顿吃不下，结果就是吃不够：缺口太大，掉的是肌肉，代谢也跟着降。', '蛋白分两顿吃，每顿 50–80g，留住肌肉的效果比一顿全吃完好。', '空腹时间拉到 23 小时，尿酸会往上走；你尿酸偏高，这一条就够否掉它。', '同样的热量和蛋白，一天一顿并不比两顿多减脂，也没有证据显示更健康。'] },
    ],
  },
  {
    group: '碳水', items: [
      { q: '主食吃什么？吃多少？', a: ['糙米饭 / 紫米饭（ข้าวกล้อง / riceberry）一小碗 150g ≈ 36g 碳水；红薯 200g ≈ 34g；燕麦片 50g ≈ 29g。', '米饭、红薯说的都是熟重（煮好、烤好以后称）；燕麦片是干重。', '每顿一份，一天两份，再加水果 1–2 份，就在 80–130g 之间。', '白米饭、白面包、面条也可以吃，但升糖快、不顶饱，量要减到上面的三分之二：白米饭一顿 100g（熟重）。'] },
      { q: '家里不开火，主食去哪买？', a: ['7-11 一般都有：即食糙米饭 / 紫米饭（盒装或杯装，让店员微波）、烤红薯（มันหวานเผา，一个 150–250g）、水煮甜玉米（ข้าวโพดต้ม，1 根 ≈ 一份）、全麦面包（โฮลวีต，2 片 ≈ 一份）、香蕉。', '燕麦片不用煮：买即食或快熟的（instant / quick oats），50g 加热水泡 3 分钟，或者前一晚用酸奶泡在冰箱里。不要买加了糖的三合一麦片。', '盒装饭看标签上的克数，一盒常常有 200g 以上，超过的那部分留到下一顿。', '首选顺序：红薯、燕麦、糙米饭 > 玉米、全麦面包 > 白米饭。'] },
      { q: '水果怎么吃？', a: ['一天 1–2 份整个的水果：香蕉 1 根、芭乐半个、苹果 1 个、木瓜或火龙果一碗。', '不喝果汁，不喝含糖饮料、奶茶，不吃蜂蜜和果干：果糖喝进去吸收快，会直接推高尿酸和甘油三酯。', '水果放在饭后吃，不单独空腹吃一大盘。'] },
      { q: '吃碳水会不会又胖回去、血糖变差？', a: ['刚恢复碳水的头几天，体重会涨 1–2 公斤，那是糖原和水，不是脂肪，不用慌。', '血糖和胰岛素主要随内脏脂肪走：腰围往下掉，它们就跟着好转。', '每顿先吃菜和蛋白，最后吃饭；饭后走 10–15 分钟，餐后血糖会低一截。'] },
    ],
  },
  {
    group: '蛋白质与尿酸', items: [
      { q: '蛋白怎么凑够 130g？', a: ['130g ≈ 7 份（1 份 = 18g = 1 袋 CP）。', '肉和鱼一天合计约一份：生重 250g 以内（CP 鸡胸也算），大约 3 份蛋白。', '蛋白粉 2 勺 ≈ 2.7 份，鸡蛋 2 个 ≈ 0.7 份，米饭、红薯和蔬菜里还有 1 份左右：这样就够了，肉不用硬塞。', '想换花样，用不升尿酸的替：豆腐、低脂酸奶、毛豆。'] },
      { q: '蛋白粉怎么喝？一天 2 勺有没有问题？', a: ['每天 2 勺，两顿各 1 勺（1 勺约 30g ≈ 蛋白 24g ≈ 1.3 份），随饭喝，在 12:00–20:00 的窗口里。', '没有问题：加上它，全天蛋白还是 130–150g（每公斤体重约 1.5–1.6g），肾功能正常的人吃这个量是安全的。乳清是奶蛋白，不升尿酸，也不占肉和鱼的额度。', '它是顶替，不是加餐：喝了这 2 勺，就不用再吃豆腐和第二袋 CP，肉的量也下来了。', '冷水或温水 250ml 摇匀，也可以拌进酸奶、燕麦里；不用开水冲（会结块），不兑果汁、不加糖。', '喝了胀气、拉肚子，多半是乳糖：换成分离乳清（isolate）。', '2 勺是上限，其余蛋白还是从饭里吃：整块的食物更顶饱。', '看标签：每勺蛋白 ≥ 20g、糖 ≤ 3g；写着「增肌粉 / mass gainer」的不要。这里的数字先按一般乳清粉估，以你那罐的标签为准。'] },
      { q: '尿酸偏高，哪些要少吃？', a: ['尽量不吃：动物内脏、浓肉汤和火锅汤底、虾蟹贝类、沙丁鱼和凤尾鱼、啤酒、含糖饮料和果汁。', '限量吃：猪牛羊红肉一周 1–2 次、每次 150g 左右；鸡肉和鱼算在每天一份的额度里。', '放心吃：鸡蛋、豆腐和豆浆、低脂奶和酸奶、所有蔬菜（蘑菇、西兰花、芦笋这些「高嘌呤蔬菜」不升尿酸）、全谷物。'] },
      { q: '只吃 CP 鸡胸行不行？', a: ['不行。130g 蛋白要 7 袋多，鸡胸肉的嘌呤属于中等偏高，全靠它尿酸下不来，钠也有 2.2g。', '一天 ≤ 3 袋，而且算进肉鱼 250g 的额度（3 袋 = 240g）。'] },
      { q: '鸡蛋一天能吃几个？', a: ['全蛋每天 ≤ 3 个，食谱里按 2 个排。', '鸡蛋几乎不含嘌呤，限制它是因为饱和脂肪：2 个蛋约 3g，占一天额度的五分之一。', '想多吃蛋就加蛋清。'] },
    ],
  },
  {
    group: '脂肪', items: [
      { q: '一天的脂肪从哪来？', a: ['以基线日为例，约 63g：橄榄油 25g、夏威夷果 20g 里有 15g、鸡蛋 2 个 10g、鸡胸 4g、蛋白粉 2 勺 4g，其余来自 CP 鸡胸、米饭和蔬菜。', '63g 里有 40g 来自橄榄油和夏威夷果，饱和脂肪只有 13g 左右。', '吃青花鱼、三文鱼的日子，鱼自带 20g 以上的脂肪，做菜的油减到 5–10g。', '别吃成水煮一切：脂肪低于 60g 容易饿，脂溶性维生素也吸收不好。'] },
      { q: '碳水吃回来了，脂肪要不要再降？', a: ['不用。60–90g 已经是中等量，约占热量的三分之一；生酮那几天是 120g 以上。', '要管的是种类：饱和脂肪 ≤ 15g（肥肉、鸡皮、椰浆、黄油、全脂奶），其余用橄榄油、坚果、鱼。', '也别超过 90g：脂肪 1g 有 9 kcal，多 20g 就是 180 kcal，一天的缺口少三分之一。'] },
      { q: '夏威夷果怎么吃？', a: ['每天 20g，约 8–10 颗 ≈ 144 kcal、脂肪 15g，其中约 12g 是单不饱和脂肪（和橄榄油同一类），饱和脂肪 2.4g。', '称出来装小盒再吃，不要抱着袋子吃：100g 就有 720 kcal。', '买原味的，不要盐焗、蜂蜜、巧克力裹层的。'] },
      { q: '橄榄油能直接喝吗？会升 LDL 吗？', a: ['能直接喝，和拌在菜里是一样的；特级初榨的有点辣喉咙，是正常的。', '不会升 LDL：它主要是单不饱和脂肪，用它替掉肥肉、黄油里的饱和脂肪，LDL 还会降一点。', '但要用汤匙量，不要对着瓶子喝：1 汤匙 ≈ 13.5g ≈ 120 kcal，「喝四口」有 40–60g，就是 350–500 kcal。', '一天 10–25g（1–2 汤匙），做菜用掉的也算在里面。'] },
      { q: '用什么油？怎么用？', a: ['炒菜、拌菜：特级初榨橄榄油；大火爆炒用牛油果油或米糠油（น้ำมันรำข้าว）。', '不用：椰子油、棕榈油（น้ำมันปาล์ม，超市最便宜的瓶装油大多是它）、黄油、猪油。', '用汤匙量，1 汤匙 ≈ 13.5g ≈ 120 kcal；一天的油 10–25g。', '咖啡喝黑的，不加黄油、椰子油、奶精。'] },
      { q: '饱和脂肪为什么要控在 15g？', a: ['饱和脂肪吃多了，肝脏回收 LDL 的受体会减少，血里的 LDL / ApoB 就升上去；换成橄榄油、坚果、鱼里的不饱和脂肪，会降回来。', '大头来源：五花肉 100g 约 19g、头道椰浆 100g 约 30g、黄油 10g 约 5g、全脂希腊酸奶 200g 约 6g、炸鸡带皮 2 块约 8g。', '再加可溶性纤维：洋车前子一天 10g（两顿饭前各 5g）、燕麦、豆类，都有助于降 LDL。'] },
    ],
  },
  {
    group: '补剂与电解质', items: [
      { q: '不生酮了，补剂有什么变化？', a: ['继续：洋车前子两顿饭前各 5g、柠檬酸钾随两顿饭各 3 粒（碱化尿液，帮尿酸排出去、防结石）、镁睡前、鱼油（当天没吃鱼才吃）、锌周一三五。', '可以停：B 族（主食和水果吃回来后不缺）、专门加的盐水。', '电解质冲剂只在出汗多的训练日喝，选无糖的。'] },
      { q: '钠（盐）怎么吃？', a: ['做菜正常放盐就够，一天钠 ≤ 3,000mg（≈ 盐 7.5g），不用再额外补盐。', '外食、CP 鸡胸、酱油和鱼露的钠多：外食那顿少蘸酱、汤少喝。'] },
      { q: '钾怎么补？', a: ['目标每天 ≥ 3,400mg。红薯、香蕉、西兰花、蘑菇、绿叶菜、豆类、鱼加起来已经有 3,000mg 以上，蔬菜别少吃。', '香蕉 1 根约 360mg，只有目标的十分之一：可以每天吃，但光靠它不够；红薯 250g 约 840mg、西兰花 200g 约 630mg，比香蕉还多。', '柠檬酸钾照现在的量吃，随餐配一大杯水。补剂里的钾（包括电解质冲剂）合计每天 ≤ 1,000mg，不要再加钾片。', '如果以后有肾病，或开始吃 ACEI / ARB / 保钾利尿剂这类降压药，要先告诉医生你在补钾。'] },
      { q: '镁怎么补？', a: ['每天补元素镁 200–350mg（补剂上限 350mg），睡前吃，选甘氨酸镁或柠檬酸镁。', '看标签上的「元素镁」：比如「甘氨酸镁 1,000mg」里的元素镁通常只有 100–140mg。', '拉肚子就减量。食物里糙米、燕麦、豆类、坚果和绿叶菜都有。'] },
    ],
  },
  {
    group: '喝水', items: [
      { q: '一天喝多少？', a: ['3–3.5L，咖啡、茶、汤都算；训练或出汗多的日子再加 0.5–1L。', '你尿酸偏高，喝够水是最便宜的降尿酸和防结石办法：目标是每天尿量 2–2.5L 以上。'] },
      { q: '怎么分配？', a: ['起床 500ml → 上午 500ml → 第一顿 300ml → 下午 700ml → 第二顿 300ml → 晚上 300–500ml。训练时每小时另加 500–750ml。', '分开喝，别一次灌 1L；睡前 2 小时少喝，免得起夜影响睡眠。'] },
      { q: '怎么知道喝够了？', a: ['看尿色：淡黄 = 刚好；深黄 = 不够；一直完全透明且跑厕所很勤 = 可以少一点。'] },
      { q: '咖啡、茶、酒？', a: ['黑咖啡、无糖茶每天 ≤ 3 杯，睡前 8 小时内不喝；想顺口最多加 30ml 牛奶。咖啡本身不升尿酸。', '酒：前 4 周 0，啤酒一直不喝；之后每次抽血前 72 小时也 0。'] },
    ],
  },
  {
    group: '什么时候去看医生', items: [
      { q: '出现哪些情况要就医？', a: ['关节突然红肿热痛（痛风）、腰腹绞痛或血尿（结石）。', '胸痛、胸闷持续不缓解，或伴随出汗、气短、晕厥：直接去急诊。', '心慌心悸、肌肉明显无力、反复严重抽筋（可能是血钾或血镁异常）。', '这里是按你的数据给的一般性建议，不是医嘱；复查结果出来后，找内科或风湿科医生看一次。'] },
    ],
  },
]
