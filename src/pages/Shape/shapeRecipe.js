// 塑形食谱：一日基线 + 一周食谱 + 蛋白替换表 + 问答。纯数据 + 纯计算，RecipePage 只负责呈现。
// 营养数值按每 100g 可食部分（生重）：大部分取自 lib/ketoPlan.js 的 FOODS；CP 按包装标签换算；
// 青花鱼、蛋清和全部饱和脂肪（sfa）取 USDA 近似值。改克数后跑 npm run test:shape——
// 每一天都必须满足 RECIPE_TARGETS（蛋白、净碳、脂肪、饱和脂肪、热量区间、鸡蛋个数），否则测试失败。
import { FOODS } from '../../lib/ketoPlan.js'
import { SHAPE_PLAN } from './shapePlan.js'

const t = SHAPE_PLAN.daily
export const RECIPE_TARGETS = {
  kcal: [1650, 1950],      // 目标约 1,800；不低于 1,500 是底线，这里留余量
  protein: t.protein,      // ≥ 150g
  netCarb: t.netCarb,      // ≤ 30g
  fat: t.fat,              // ≤ 120g（上限，不是要吃够）
  satFat: t.satFat,        // ≤ 20g
  eggsMax: 3,              // 全蛋每天 ≤ 3 个（ApoB 出来前）
  mealProtein: 40,         // 三顿正餐每顿 ≥ 40g
}

const base = (k, extra) => ({ ...FOODS[k], ...extra })

// kind：protein 蛋白 / veg 蔬菜 / fat 脂肪坚果。unit：按个、袋计数的食物（g = 每个/每袋克数）
export const RECIPE_FOODS = {
  cp: { name: 'CP 打抛嫩鸡胸', kind: 'protein', kcal: 112.5, p: 22.5, f: 1.875, c: 1.25, sfa: 0, unit: { label: '袋', g: 80 }, note: '7-11 อกไก่นุ่มกะเพรา，标签每袋 90kcal / 蛋白 18g / 钠 310mg' },
  egg: base('egg', { kind: 'protein', sfa: 3.1, unit: { label: '个', g: 50 } }),
  eggWhite: { name: '蛋清', kind: 'protein', kcal: 52, p: 10.9, f: 0.2, c: 0.7, sfa: 0, unit: { label: '个', g: 33 } },
  chickenBreast: base('chickenBreast', { name: '生鸡胸肉', kind: 'protein', sfa: 0.6 }),
  shrimp: base('shrimp', { kind: 'protein', sfa: 0.1 }),
  seabass: base('seabass', { kind: 'protein', sfa: 0.8 }),
  mackerel: { name: '青花鱼', kind: 'protein', kcal: 205, p: 18.6, f: 13.9, c: 0, sfa: 3.26, note: '冷冻ซาบะ很多是腌过的，咸的就别再放盐' },
  salmon: base('salmon', { kind: 'protein', sfa: 3.05 }),
  beefLean: base('beefLean', { name: '瘦牛肉', kind: 'protein', sfa: 1.8 }),
  tofu: base('tofu', { kind: 'protein', sfa: 0.7 }),
  greekYogurt: base('greekYogurt', { kind: 'protein', sfa: 3.2 }),
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

// 「3 个（150g）」「1 袋（80g）」「半个（70g）」「200g」
export function amountLabel(key, g) {
  const u = RECIPE_FOODS[key]?.unit
  if (!u) return `${g}g`
  const n = g / u.g
  if (key === 'avocado') return n === 0.5 ? `半个（${g}g 果肉）` : n === 1 ? `1 个（${g}g 果肉）` : `${g}g 果肉`
  return Number.isInteger(n) ? `${n} ${u.label}（${g}g）` : `${g}g`
}

// 每天各项是否达标；正餐（不含加餐）每顿蛋白 ≥ 40g
export function dayChecks(day, T = RECIPE_TARGETS) {
  const s = dayTotals(day)
  const mains = day.meals.filter(m => m.slot !== 'snack').map(m => sumItems(m.items).p)
  return {
    kcal: s.kcal >= T.kcal[0] && s.kcal <= T.kcal[1],
    protein: s.p >= T.protein,
    netCarb: s.c <= T.netCarb,
    fat: s.f <= T.fat,
    satFat: s.sfa <= T.satFat,
    eggs: eggCount(day) <= T.eggsMax,
    mealProtein: mains.every(p => p >= T.mealProtein),
  }
}

// 一周采购：同一食物克数相加；按个/袋的换算成个数（向上取整）
export function shoppingList(days) {
  const m = new Map()
  for (const d of days) for (const [k, g] of dayItems(d)) m.set(k, (m.get(k) || 0) + g)
  return [...m.entries()].map(([key, g]) => {
    const u = RECIPE_FOODS[key].unit
    return { key, g, label: u ? `${Math.ceil(g / u.g)} ${u.label}（${g}g）` : g >= 1000 ? `${r1(g / 1000)}kg` : `${g}g` }
  }).sort((a, b) => ['protein', 'veg', 'fat'].indexOf(RECIPE_FOODS[a.key].kind) - ['protein', 'veg', 'fat'].indexOf(RECIPE_FOODS[b.key].kind) || b.g - a.g)
}

// ── 蛋白替换：1 份 = 18g 蛋白 = 1 袋 CP ──
export const PROTEIN_UNIT = 18
export const PROTEIN_SWAPS = [
  { key: 'cp', g: 80, tag: '精瘦', tip: '一天 ≤ 4 袋（钠）' },
  { key: 'chickenBreast', g: 80, tag: '精瘦', tip: '生重；空气炸锅最省事' },
  { key: 'shrimp', g: 90, tag: '精瘦', tip: '' },
  { key: 'seabass', g: 100, tag: '精瘦', tip: '清蒸、盐烤都行' },
  { key: 'eggWhite', g: 165, tag: '精瘦', tip: '想多吃蛋就加蛋清' },
  { key: 'beefLean', g: 85, tag: '精瘦', tip: '选瘦的部位，不要肥牛卷' },
  { key: 'tofu', g: 150, tag: '中等', tip: '净碳约 2g' },
  { key: 'egg', g: 150, tag: '高脂', tip: '全蛋每天 ≤ 3 个' },
  { key: 'mackerel', g: 100, tag: '高脂', tip: 'omega-3 多' },
  { key: 'salmon', g: 90, tag: '高脂', tip: 'omega-3 多' },
  { key: 'greekYogurt', g: 200, tag: '高脂', tip: '净碳 8g，当加餐偶尔吃' },
]

// ── 一周食谱：周一就是基线日，其余按同一结构换蛋白和蔬菜 ──
const B = (veg, extra = []) => ({
  slot: 'breakfast', time: '8:30', name: `炒蛋 + CP 鸡胸 + ${RECIPE_FOODS[veg].name} + 牛油果`,
  how: `${RECIPE_FOODS[veg].name}切段，5g 橄榄油中火炒 2 分钟，打入 3 个蛋炒熟；CP 鸡胸撕开直接吃或一起炒热；牛油果切半个，另一半留晚餐。`,
  items: [['egg', 150], ['cp', 80], [veg, 150], ['oliveOil', 5], ['avocado', 70], ...extra],
})

export const BASELINE_DAY = {
  day: '周一', theme: '基线日',
  meals: [
    B('choySum'),
    { slot: 'lunch', time: '12:30', name: 'CP 鸡胸 3 袋 + 空气炸锅西兰花蘑菇', how: '西兰花切小朵、蘑菇对半切，喷 5g 橄榄油、撒盐，190°C 空气炸 10–12 分钟；出锅再淋 10g 橄榄油。CP 鸡胸可一起放进去热 3 分钟。', items: [['cp', 240], ['broccoli', 150], ['mushroom', 100], ['oliveOil', 15]] },
    { slot: 'snack', time: '16:00', name: '巴旦木一小把', how: '30g 约 23 颗，提前分装好，别抱着袋子吃。', items: [['almond', 30]] },
    { slot: 'dinner', time: '18:30', name: '空气炸锅青花鱼 + 白灼菜心 + 牛油果生菜沙拉', how: '青花鱼解冻后皮朝上，200°C 空气炸 10–12 分钟，不用放油（腌过的就不放盐）。菜心水开焯 1 分钟，淋少许酱油、蒜末。生菜撕开拌另外半个牛油果和 5g 橄榄油。', items: [['mackerel', 200], ['choySum', 200], ['lettuce', 100], ['avocado', 70], ['oliveOil', 5]] },
  ],
}

export const WEEK = [
  BASELINE_DAY,
  {
    day: '周二', theme: '虾仁日',
    meals: [
      B('zucchini'),
      { slot: 'lunch', time: '12:30', name: 'CP 鸡胸 3 袋 + 空气炸锅花菜', how: '花菜切小朵，喷 5g 橄榄油、撒盐和咖喱粉，190°C 空气炸 12 分钟；出锅淋 10g 橄榄油。', items: [['cp', 240], ['cauliflower', 200], ['oliveOil', 15]] },
      { slot: 'snack', time: '16:00', name: '南瓜子 + 巴旦木', how: '南瓜子 25g（约 2 大勺，镁很多）+ 巴旦木 15g（约 12 颗）。虾仁日蛋白很精瘦，这里补点脂肪。', items: [['pumpkinSeed', 25], ['almond', 15]] },
      { slot: 'dinner', time: '18:30', name: '蒜蓉虾仁炒西兰花蘑菇 + 牛油果', how: '15g 橄榄油中火爆香蒜末，下虾仁炒 2 分钟变色，加西兰花、蘑菇和少许水炒 3 分钟，盐、黑胡椒调味。另外半个牛油果直接吃。', items: [['shrimp', 250], ['broccoli', 150], ['mushroom', 100], ['oliveOil', 15], ['avocado', 70]] },
    ],
  },
  {
    day: '周三', theme: '三文鱼日',
    meals: [
      B('asparagus'),
      { slot: 'lunch', time: '12:30', name: '空气炸锅鸡胸 + 炒包菜', how: '鸡胸片成两片，盐、黑胡椒、蒜粉腌 15 分钟，喷 5g 油，200°C 空气炸 12–14 分钟，中途翻面，切开不粉红就熟了。包菜手撕，10g 橄榄油大火炒 2 分钟。', items: [['chickenBreast', 250], ['cabbage', 200], ['oliveOil', 15]] },
      { slot: 'snack', time: '16:00', name: '核桃', how: '30g 约 7 个。', items: [['walnut', 30]] },
      { slot: 'dinner', time: '18:30', name: '空气炸锅三文鱼 + 西兰花 + 生菜', how: '三文鱼皮朝下，撒盐、黑胡椒，200°C 空气炸 10–12 分钟，不用放油。西兰花焯 2 分钟，和生菜一起淋 5g 橄榄油。', items: [['salmon', 200], ['broccoli', 200], ['lettuce', 100], ['oliveOil', 5]] },
    ],
  },
  {
    day: '周四', theme: '牛肉日',
    meals: [
      B('choySum'),
      { slot: 'lunch', time: '12:30', name: 'CP 鸡胸沙拉', how: 'CP 鸡胸撕条，生菜、黄瓜切好，淋 10g 橄榄油 + 青柠汁 + 盐 + 黑胡椒。', items: [['cp', 240], ['lettuce', 100], ['cucumber', 150], ['oliveOil', 10]] },
      { slot: 'snack', time: '16:00', name: '巴旦木', how: '25g 约 20 颗。', items: [['almond', 25]] },
      { slot: 'dinner', time: '18:30', name: '黑椒牛肉炒青椒蘑菇 + 牛油果', how: '牛肉逆纹切片，黑胡椒、少许酱油腌 10 分钟；15g 牛油果油或米糠油大火快炒 2 分钟盛出，再炒青椒蘑菇，回锅拌匀。另外半个牛油果直接吃。', items: [['beefLean', 250], ['greenPepper', 150], ['mushroom', 150], ['oliveOil', 15], ['avocado', 70]] },
    ],
  },
  {
    day: '周五', theme: '清蒸鱼日',
    meals: [
      B('zucchini'),
      { slot: 'lunch', time: '12:30', name: 'CP 鸡胸 3 袋 + 空气炸锅西兰花花菜', how: '西兰花、花菜切小朵，喷 5g 油撒盐，190°C 空气炸 10–12 分钟；出锅淋 10g 橄榄油。', items: [['cp', 240], ['broccoli', 150], ['cauliflower', 100], ['oliveOil', 15]] },
      { slot: 'snack', time: '16:00', name: '无糖希腊酸奶 + 核桃', how: '100g 酸奶 + 10g 核桃碎。买「plain / ไม่มีน้ำตาล」的，别买加果酱的；酸奶有碳水，别多吃。', items: [['greekYogurt', 100], ['walnut', 10]] },
      { slot: 'dinner', time: '18:30', name: '泰式清蒸鲈鱼 + 白灼菜心 + 牛油果', how: '鲈鱼两面划刀，姜片垫底，水开蒸 8–10 分钟，倒掉蒸出的水，淋青柠汁、蒜末、辣椒和少许鱼露（不放糖），再淋 10g 橄榄油。菜心焯 1 分钟。另外半个牛油果直接吃。', items: [['seabass', 300], ['choySum', 200], ['oliveOil', 10], ['avocado', 70]] },
    ],
  },
  {
    day: '周六', theme: '青花鱼日',
    meals: [
      B('asparagus'),
      { slot: 'lunch', time: '12:30', name: '空气炸锅鸡胸 + 包菜番茄', how: '鸡胸做法同周三。包菜、番茄切块，10g 橄榄油炒 3 分钟。', items: [['chickenBreast', 250], ['cabbage', 150], ['tomato', 80], ['oliveOil', 15]] },
      { slot: 'snack', time: '16:00', name: '巴旦木', how: '30g 约 23 颗。', items: [['almond', 30]] },
      { slot: 'dinner', time: '18:30', name: '空气炸锅青花鱼 + 菜心 + 黄瓜', how: '青花鱼做法同周一。菜心焯 1 分钟，黄瓜拍碎拌蒜末、青柠汁和 5g 橄榄油。', items: [['mackerel', 200], ['choySum', 200], ['cucumber', 100], ['oliveOil', 5]] },
    ],
  },
  {
    day: '周日', theme: '外食日',
    meals: [
      B('choySum'),
      { slot: 'lunch', time: '12:30', name: '7-11 快手：CP 鸡胸 3 袋 + 沙拉', how: '7-11 的 CP 鸡胸 3 袋 + 一盒生菜黄瓜沙拉（酱汁别用，或只用一半）+ 10g 橄榄油（可以自带小瓶）。', items: [['cp', 240], ['lettuce', 100], ['cucumber', 100], ['oliveOil', 10]] },
      { slot: 'snack', time: '16:00', name: '南瓜子', how: '30g 约 2 大勺半。', items: [['pumpkinSeed', 30]] },
      { slot: 'dinner', time: '18:30', name: '泰餐馆：盐烤鱼 + 清汤冬阴功虾 + 清炒菜心', how: '点 ปลาเผาเกลือ（盐烤鱼，吃约 300g 鱼肉，不蘸甜酱）、ต้มยำกุ้งน้ำใส（清汤冬阴功，不要 น้ำข้น 椰奶版）、ผัดผักกาดกวางตุ้ง（炒菜心，说 น้ำมันน้อย ไม่ใส่น้ำตาล：少油不放糖）。不吃米饭。餐馆炒菜用油多，按 20g 算。', items: [['seabass', 300], ['shrimp', 120], ['mushroom', 100], ['tomato', 50], ['choySum', 200], ['oliveOil', 20]] },
    ],
  },
]

// ── 问答 ──
export const QA = [
  {
    group: '基线', items: [
      { q: '一天到底吃多少？', a: ['热量约 1,800 kcal（1,700–1,900 都行，最低别低于 1,500）。', '蛋白 ≥ 150g，三顿正餐每顿 ≥ 40g。', '净碳水 ≤ 30g，基本全部来自蔬菜。', '脂肪 ≤ 120g，这是上限，不是要吃够的量；其中饱和脂肪 ≤ 20g。', '顺序：先把蛋白吃够 → 蔬菜吃够 → 脂肪补到不饿为止，不超上限。'] },
      { q: '生酮是不是要多吃油？', a: ['不是。进入酮症靠的是碳水压到 30g 以下，不是靠多吃油。', '基线一天脂肪约 110g，已经占热量 55% 左右，就是生酮比例；身体其余的燃料来自你身上的脂肪，这正是减脂要的。', '「先吃够脂肪再制造缺口」会把缺口吃没：按经典生酮 70–75% 脂肪配 150g 蛋白，一天会到 2,400–2,900 kcal。'] },
    ],
  },
  {
    group: '蛋白质', items: [
      { q: '只吃 CP 鸡胸要几袋？', a: ['150g ÷ 18g ≈ 8–9 袋，但 9 袋的钠就有 2.8g，不建议。', '一天 ≤ 4 袋（钠 1,240mg），其余用蛋、鱼、肉、虾补。'] },
      { q: '只吃鸡蛋呢？一天能吃 6 个吗？', a: ['只靠鸡蛋要 24 个，不现实。', '全蛋每天 3 个：6 个蛋的饱和脂肪约 9g，一下用掉半天额度，而你的 ApoB 还没查。', '想多吃蛋：3 个全蛋 + 3 个蛋清，蛋白约 30g、饱和脂肪只有 4.7g。', 'ApoB 出来 < 90 之后，全蛋可以放宽到 4–5 个。'] },
      { q: '怎么替换？', a: ['1 份 = 18g 蛋白 = 1 袋 CP，按「蛋白替换」表等量换。', '换成高脂蛋白（鸡蛋、青花鱼、三文鱼）时，同一餐少放 10g 油；换成精瘦蛋白可以多放 5–10g。'] },
    ],
  },
  {
    group: '脂肪', items: [
      { q: '一天的脂肪从哪来？', a: ['以基线日为例，约 111g：肉蛋鱼自带约 50g，牛油果 1 个约 21g，坚果 30g 约 15g，加的油 25g（早 5g、午 15g、晚 5g）。', '不够饱就先加蔬菜和蛋白，再加 10g 坚果，最后才是油。'] },
      { q: '用什么油？怎么用？', a: ['炒菜、拌菜：特级初榨橄榄油；不喜欢它的味道就用 light 橄榄油或牛油果油。大火爆炒：牛油果油或米糠油（น้ำมันรำข้าว）。', '不用：棕榈油（น้ำมันปาล์ม，超市最便宜的瓶装油大多是它）、椰子油、黄油、猪油。', '空气炸锅前喷一层（2–3g），剩下的出锅再淋；用汤匙量，1 汤匙 ≈ 13.5g ≈ 120 kcal。', '咖啡喝黑的，不做防弹咖啡。'] },
      { q: '饱和脂肪为什么要控在 20g？', a: ['生酮在血脂上最大的风险，是饱和脂肪把 LDL / ApoB 推高；你的血脂本来就偏高（ApoB 待查），更要控。', '大头来源：防弹咖啡一杯约 19g、头道椰浆 100g 约 30g、五花肉 100g 约 19g、黄油 10g 约 5g。'] },
    ],
  },
  {
    group: '电解质', items: [
      { q: '为什么生酮要管电解质？', a: ['碳水降下来后胰岛素降低，头 1–2 周肾脏会多排钠和水，钾、镁也跟着流失。', '头痛、乏力、头晕、抽筋、心慌（俗称「生酮流感」，多在第 2–5 天）大多是这个原因，不是碳水戒断。'] },
      { q: '钠（盐）怎么补？', a: ['基线：做菜正常放盐，加上 CP（每袋 310mg），一天钠大约 2–3g（≈ 盐 5–7.5g），不额外吃盐片。', '出现上面那些症状时：500ml 水或一碗清汤加 1/4 茶匙盐（约 0.6g 钠），一天 1–2 次，症状过去就停。', '家庭血压 ≥ 130/85 时不额外加盐，先去看医生。'] },
      { q: '钾怎么补？', a: ['目标每天 ≥ 3,400mg。基线食谱里的牛油果、西兰花、蘑菇、绿叶菜、鱼、坚果加起来已经有约 4,000mg，蔬菜别少吃。', '柠檬酸钾照现在的量吃，随餐配一大杯水。补剂里的钾（包括电解质冲剂）合计每天 ≤ 1,000mg，不要再加钾片。', '如果以后有肾病，或开始吃 ACEI / ARB / 保钾利尿剂这类降压药，要先告诉医生你在补钾。近期抽血会查血钾。'] },
      { q: '镁怎么补？', a: ['每天补元素镁 200–350mg（补剂上限 350mg），睡前吃，选甘氨酸镁或柠檬酸镁。', '看标签上的「元素镁」：比如「甘氨酸镁 1,000mg」里的元素镁通常只有 100–140mg。', '拉肚子就减量。食物里南瓜子 25g 约 150mg、坚果和绿叶菜也有。'] },
      { q: '电解质冲剂要不要喝？', a: ['不是必需。要喝就选无糖的，把里面的钠和钾算进上面的量。', '生酮流感那几天、训练出汗多（曼谷天热）时喝一份最有用。'] },
    ],
  },
  {
    group: '喝水', items: [
      { q: '一天喝多少？', a: ['3–3.5L，咖啡、茶、汤都算；训练或出汗多的日子再加 0.5–1L。', '你尿酸偏高、又在生酮早期，结石风险偏高，喝够水是最便宜的预防：目标是每天尿量 2–2.5L 以上。'] },
      { q: '怎么分配？', a: ['起床 500ml → 早餐 300ml → 上午 500ml → 午餐 300ml → 下午 500ml → 晚餐 300ml → 晚上 300–500ml。训练时每小时另加 500–750ml。', '分开喝，别一次灌 1L；睡前 2 小时少喝，免得起夜影响睡眠。'] },
      { q: '怎么知道喝够了？', a: ['看尿色：淡黄 = 刚好；深黄 = 不够；一直完全透明且跑厕所很勤 = 可以少一点。'] },
      { q: '咖啡、茶、酒？', a: ['黑咖啡、无糖茶每天 ≤ 3 杯，睡前 8 小时内不喝；不加黄油、椰子油、奶精、糖，想顺口最多加 30ml 牛奶。', '酒：前 4 周 0；之后每次抽血前 72 小时也 0。'] },
    ],
  },
  {
    group: '什么时候去看医生', items: [
      { q: '出现哪些情况要就医？', a: ['心慌心悸、肌肉明显无力、反复严重抽筋（可能是血钾或血镁异常）。', '关节突然红肿热痛（痛风）、腰腹绞痛或血尿（结石）。', '皮疹扩散、起水疱，或胸痛、胸闷、晕厥。', '这里是按你的数据给的一般性建议，不是医嘱；抽血和血压结果出来后，找内科或内分泌医生看一次。'] },
    ],
  },
]
