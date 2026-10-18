// 一周健康生酮食谱（定量版，静态数据）：页面 MealPlan 与海报 scripts/render-keto-poster.mjs 共用这一份。
// 思路是「Well-formulated keto」：净碳水压低，但蔬菜吃足、蛋白质适量、优质脂肪为主、电解质补够。
// 每样食材给定克数（可食部分生重），营养按下方 FOODS 每 100g 数值自动汇总——
// 改克数/换菜只动 KETO_WEEK，热量、蛋白、净碳、采购清单全部跟着重算。
// 营养数值取自 USDA / 中国食物成分表的常见值，取整；调味料（盐、酱油、葱姜蒜、香料）不计。

// 参考人群：70kg 成年男性、减脂期。体重不同按比例增减肉类克数即可。
export const KETO_PROFILE = { weightKg: 70, kcalRange: [1600, 1900], proteinRange: [85, 120], netCarbMax: 30 }

// 每 100g：kcal / 蛋白 p / 脂肪 f / 净碳 c（总碳水 − 膳食纤维）；cat 用于采购清单分组
export const FOODS = {
  egg: { name: '鸡蛋', cat: '蛋白质', kcal: 143, p: 12.6, f: 9.5, c: 0.7, unit: '个≈50g' },
  chickenThigh: { name: '去骨带皮鸡腿肉', cat: '蛋白质', kcal: 221, p: 16.5, f: 16.9, c: 0 },
  chickenBreast: { name: '鸡胸肉', cat: '蛋白质', kcal: 120, p: 22.5, f: 2.6, c: 0 },
  chickenWing: { name: '鸡中翅（可食部分）', cat: '蛋白质', kcal: 191, p: 17.5, f: 12.8, c: 0 },
  salmon: { name: '三文鱼', cat: '蛋白质', kcal: 208, p: 20.4, f: 13.4, c: 0 },
  seabass: { name: '鲈鱼（净肉）', cat: '蛋白质', kcal: 105, p: 18.6, f: 3.4, c: 0 },
  cod: { name: '鳕鱼', cat: '蛋白质', kcal: 82, p: 17.8, f: 0.7, c: 0 },
  shrimp: { name: '鲜虾仁', cat: '蛋白质', kcal: 85, p: 20.1, f: 0.5, c: 0 },
  beefLean: { name: '黄牛肉（瘦）', cat: '蛋白质', kcal: 125, p: 21, f: 4.5, c: 0 },
  brisket: { name: '牛腩', cat: '蛋白质', kcal: 251, p: 17.4, f: 19.5, c: 0 },
  fattyBeef: { name: '肥牛卷', cat: '蛋白质', kcal: 250, p: 16, f: 20, c: 0 },
  lamb: { name: '羊肉', cat: '蛋白质', kcal: 203, p: 19, f: 14, c: 0 },
  porkCollar: { name: '梅花肉', cat: '蛋白质', kcal: 220, p: 17, f: 17, c: 0 },
  tofu: { name: '北豆腐', cat: '蛋白质', kcal: 98, p: 12.2, f: 4.8, c: 1.5 },
  greekYogurt: { name: '无糖希腊酸奶', cat: '奶蛋豆', kcal: 97, p: 9, f: 5, c: 4 },
  cheese: { name: '天然切达芝士', cat: '奶蛋豆', kcal: 403, p: 24.9, f: 33.1, c: 1.3 },
  soyMilk: { name: '无糖豆浆', cat: '奶蛋豆', kcal: 31, p: 3, f: 1.6, c: 1 },
  spinach: { name: '菠菜', cat: '蔬菜', kcal: 23, p: 2.9, f: 0.4, c: 1.4 },
  broccoli: { name: '西兰花', cat: '蔬菜', kcal: 34, p: 2.8, f: 0.4, c: 4 },
  cauliflower: { name: '花菜', cat: '蔬菜', kcal: 25, p: 1.9, f: 0.3, c: 3 },
  zucchini: { name: '西葫芦', cat: '蔬菜', kcal: 17, p: 1.2, f: 0.3, c: 2.1 },
  mushroom: { name: '蘑菇', cat: '蔬菜', kcal: 22, p: 3.1, f: 0.3, c: 2.3 },
  asparagus: { name: '芦笋', cat: '蔬菜', kcal: 20, p: 2.2, f: 0.1, c: 1.8 },
  lettuce: { name: '生菜', cat: '蔬菜', kcal: 15, p: 1.4, f: 0.2, c: 1.6 },
  cucumber: { name: '黄瓜', cat: '蔬菜', kcal: 15, p: 0.7, f: 0.1, c: 3.1 },
  woodEar: { name: '木耳（泡发）', cat: '蔬菜', kcal: 27, p: 1.5, f: 0.2, c: 3.4 },
  choySum: { name: '菜心', cat: '蔬菜', kcal: 25, p: 2.8, f: 0.5, c: 2.3 },
  romaine: { name: '油麦菜', cat: '蔬菜', kcal: 15, p: 1.4, f: 0.4, c: 1.5 },
  waterSpinach: { name: '空心菜', cat: '蔬菜', kcal: 20, p: 2.2, f: 0.3, c: 2.2 },
  cabbage: { name: '包菜', cat: '蔬菜', kcal: 25, p: 1.3, f: 0.1, c: 3.3 },
  greenPepper: { name: '青椒', cat: '蔬菜', kcal: 20, p: 0.9, f: 0.2, c: 2.9 },
  tomato: { name: '番茄', cat: '蔬菜', kcal: 18, p: 0.9, f: 0.2, c: 2.7 },
  radish: { name: '白萝卜', cat: '蔬菜', kcal: 16, p: 0.6, f: 0.1, c: 2.5 },
  waxGourd: { name: '冬瓜', cat: '蔬菜', kcal: 12, p: 0.4, f: 0.2, c: 1.9 },
  enoki: { name: '金针菇', cat: '蔬菜', kcal: 32, p: 2.4, f: 0.4, c: 3.3 },
  avocado: { name: '牛油果（果肉）', cat: '脂肪/坚果', kcal: 160, p: 2, f: 14.7, c: 1.8, unit: '半个≈70g' },
  oliveOil: { name: '橄榄油', cat: '脂肪/坚果', kcal: 884, p: 0, f: 100, c: 0 },
  sesameOil: { name: '香油', cat: '脂肪/坚果', kcal: 898, p: 0, f: 99.8, c: 0 },
  butter: { name: '黄油', cat: '脂肪/坚果', kcal: 717, p: 0.9, f: 81, c: 0.1 },
  walnut: { name: '核桃仁', cat: '脂肪/坚果', kcal: 654, p: 15.2, f: 65.2, c: 7 },
  almond: { name: '巴旦木', cat: '脂肪/坚果', kcal: 579, p: 21.2, f: 49.9, c: 9.1 },
  pumpkinSeed: { name: '南瓜子仁', cat: '脂肪/坚果', kcal: 559, p: 30, f: 49, c: 4.7 },
  peanutButter: { name: '无糖花生酱', cat: '脂肪/坚果', kcal: 588, p: 25, f: 50, c: 14 },
  chia: { name: '奇亚籽', cat: '脂肪/坚果', kcal: 486, p: 16.5, f: 30.7, c: 7.7 },
  blueberry: { name: '蓝莓', cat: '脂肪/坚果', kcal: 57, p: 0.7, f: 0.3, c: 12.1 },
  darkChoc: { name: '85% 黑巧', cat: '脂肪/坚果', kcal: 584, p: 12.5, f: 46, c: 14 },
}

export const MEAL_SLOTS = [
  { key: 'breakfast', label: '早餐', icon: '🌅' },
  { key: 'lunch', label: '午餐', icon: '☀️' },
  { key: 'dinner', label: '晚餐', icon: '🌙' },
  { key: 'snack', label: '加餐', icon: '🥜' },
]

// items: [食材 key, 克数]。air: 当天的空气炸锅菜（每天一道）
const WEEK_RAW = [
  {
    day: '周一', theme: '启动日 · 鸡腿',
    breakfast: { name: '菠菜炒蛋 + 牛油果', items: [['egg', 150], ['spinach', 150], ['oliveOil', 10], ['avocado', 70]] },
    lunch: { name: '清蒸鲈鱼 + 蒜蓉西兰花', items: [['seabass', 220], ['broccoli', 200], ['oliveOil', 15]] },
    dinner: {
      name: '空气炸锅脆皮鸡腿 + 凉拌黄瓜木耳 + 油醋生菜', items: [['chickenThigh', 200], ['cucumber', 150], ['woodEar', 50], ['sesameOil', 5], ['lettuce', 100], ['oliveOil', 10]],
      air: { dish: '脆皮鸡腿', how: '去骨鸡腿肉皮朝下，盐+黑胡椒+蒜粉腌 20 分钟；200°C 18 分钟，中途翻面，最后 3 分钟皮朝上逼油' },
    },
    snack: { name: '核桃', items: [['walnut', 30]] },
  },
  {
    day: '周二', theme: '三文鱼 · Omega-3',
    breakfast: { name: '希腊酸奶 + 奇亚籽 + 蓝莓 + 核桃', items: [['greekYogurt', 150], ['chia', 15], ['blueberry', 30], ['walnut', 15]] },
    lunch: { name: '青椒炒牛肉 + 白灼菜心', items: [['beefLean', 150], ['greenPepper', 150], ['oliveOil', 15], ['choySum', 200], ['oliveOil', 10]] },
    dinner: {
      name: '空气炸锅三文鱼芦笋 + 黄油蘑菇', items: [['salmon', 180], ['asparagus', 150], ['oliveOil', 10], ['mushroom', 150], ['butter', 15]],
      air: { dish: '三文鱼 + 芦笋同篮', how: '三文鱼抹盐、黑胡椒、柠檬汁，芦笋刷橄榄油；180°C 10–12 分钟，不用翻面' },
    },
    snack: { name: '牛油果半个 + 芝士', items: [['avocado', 70], ['cheese', 20]] },
  },
  {
    day: '周三', theme: '大虾 · 牛腩',
    breakfast: { name: '水煮蛋 + 牛油果 + 无糖豆浆', items: [['egg', 100], ['avocado', 70], ['soyMilk', 250]] },
    lunch: { name: '清炖牛腩萝卜 + 蒜蓉油麦菜', items: [['brisket', 150], ['radish', 150], ['romaine', 200], ['oliveOil', 15]] },
    dinner: {
      name: '空气炸锅椒盐虾 + 蒜蓉空心菜 + 凉拌豆腐', items: [['shrimp', 200], ['oliveOil', 10], ['waterSpinach', 200], ['oliveOil', 12], ['tofu', 150], ['sesameOil', 5]],
      air: { dish: '椒盐大虾', how: '虾仁擦干，拌少许油+椒盐+蒜末；200°C 8 分钟，中途翻一次，别过火' },
    },
    snack: { name: '巴旦木', items: [['almond', 30]] },
  },
  {
    day: '周四', theme: '轻食 · 沙拉日',
    breakfast: { name: '菠菜芝士欧姆蛋', items: [['egg', 150], ['spinach', 80], ['cheese', 30], ['butter', 10]] },
    lunch: {
      name: '空气炸锅鸡胸大沙拉', items: [['chickenBreast', 150], ['lettuce', 150], ['cucumber', 100], ['avocado', 70], ['oliveOil', 15], ['pumpkinSeed', 10]],
      air: { dish: '嫩煎风鸡胸', how: '鸡胸横切成两片薄片，橄榄油+盐+黑胡椒+烟熏红椒粉；180°C 12 分钟，静置 3 分钟再切' },
    },
    dinner: { name: '鳕鱼豆腐汤 + 干锅花菜', items: [['cod', 180], ['tofu', 150], ['cauliflower', 200], ['oliveOil', 15]] },
    snack: { name: '黄瓜条 + 无糖花生酱 + 核桃', items: [['cucumber', 100], ['peanutButter', 20], ['walnut', 15]] },
  },
  {
    day: '周五', theme: '聚餐日 · 清汤火锅',
    breakfast: { name: '水煮蛋 + 牛油果', items: [['egg', 100], ['avocado', 100]] },
    lunch: {
      name: '空气炸锅孜然牛肉粒 + 手撕包菜', items: [['beefLean', 150], ['oliveOil', 8], ['cabbage', 200], ['oliveOil', 12]],
      air: { dish: '孜然牛肉粒', how: '牛肉切 2cm 丁，油+盐+孜然+辣椒粉腌 15 分钟（不放淀粉）；200°C 8–10 分钟，中途摇篮' },
    },
    dinner: { name: '清汤/菌汤火锅（蘸料：香油+蒜+葱+小米辣）', items: [['fattyBeef', 150], ['lamb', 100], ['shrimp', 100], ['tofu', 100], ['mushroom', 150], ['lettuce', 200], ['sesameOil', 15]] },
    snack: { name: '—（聚餐日省略）', items: [] },
  },
  {
    day: '周六', theme: '鸡翅 · 解馋日',
    breakfast: { name: '花菜「炒饭」（花菜碎 + 鸡蛋 + 虾仁）', items: [['cauliflower', 250], ['egg', 100], ['shrimp', 80], ['oliveOil', 15]] },
    lunch: {
      name: '空气炸锅鸡翅 + 牛油果蔬菜沙拉', items: [['chickenWing', 200], ['lettuce', 150], ['cucumber', 100], ['tomato', 50], ['avocado', 70], ['oliveOil', 15]],
      air: { dish: '黑椒鸡中翅', how: '8 个中翅（带骨约 350g）划两刀，盐+黑胡椒+生抽少许腌 30 分钟；200°C 20 分钟，10 分钟时翻面' },
    },
    dinner: { name: '白切鸡腿 + 蒜蓉西葫芦', items: [['chickenThigh', 150], ['zucchini', 250], ['oliveOil', 15]] },
    snack: { name: '85% 黑巧', items: [['darkChoc', 15]] },
  },
  {
    day: '周日', theme: '备餐日 · 炖汤',
    breakfast: { name: '希腊酸奶 + 核桃', items: [['greekYogurt', 150], ['walnut', 25]] },
    lunch: { name: '冬瓜羊肉汤 + 清炒菠菜', items: [['lamb', 150], ['waxGourd', 250], ['spinach', 200], ['oliveOil', 15]] },
    dinner: {
      name: '空气炸锅梅花肉金针菇 + 西兰花 + 蒸蛋', items: [['porkCollar', 150], ['enoki', 100], ['broccoli', 150], ['oliveOil', 10], ['egg', 100]],
      air: { dish: '梅花肉卷金针菇', how: '梅花肉切薄片卷金针菇，西兰花刷油同篮；190°C 12 分钟，出锅撒孜然或椒盐' },
    },
    snack: { name: '芝士 + 巴旦木', items: [['cheese', 30], ['almond', 15]] },
  },
]

const r1 = n => Math.round(n * 10) / 10

function sumItems(items) {
  const t = { kcal: 0, p: 0, f: 0, c: 0 }
  for (const [key, g] of items) {
    const food = FOODS[key]
    for (const k of Object.keys(t)) t[k] += food[k] * g / 100
  }
  return { kcal: Math.round(t.kcal), p: r1(t.p), f: r1(t.f), c: r1(t.c) }
}

function sumTotals(list) {
  const t = { kcal: 0, p: 0, f: 0, c: 0 }
  for (const x of list) for (const k of Object.keys(t)) t[k] += x[k]
  return { kcal: Math.round(t.kcal), p: r1(t.p), f: r1(t.f), c: r1(t.c) }
}

// 供能比：蛋白/碳水 4 kcal/g，脂肪 9 kcal/g
export function macroPct({ p, f, c }) {
  const e = p * 4 + f * 9 + c * 4
  return { p: Math.round(p * 4 / e * 100), f: Math.round(f * 9 / e * 100), c: Math.round(c * 4 / e * 100) }
}

// 食材行的展示文字：「鸡蛋 150g（3 个）」
export function itemLabel([key, g]) {
  const food = FOODS[key]
  if (key === 'egg') return `${food.name} ${g / 50} 个`
  return `${food.name} ${g}g`
}

export const KETO_WEEK = WEEK_RAW.map(d => {
  const meals = Object.fromEntries(MEAL_SLOTS.map(s => [s.key, { ...d[s.key], total: sumItems(d[s.key].items) }]))
  const total = sumTotals(MEAL_SLOTS.map(s => meals[s.key].total))
  const air = MEAL_SLOTS.map(s => meals[s.key].air && { slot: s.label, ...meals[s.key].air }).find(Boolean)
  return { day: d.day, theme: d.theme, ...meals, total, pct: macroPct(total), air }
})

export const KETO_WEEK_AVG = (() => {
  const t = sumTotals(KETO_WEEK.map(d => d.total))
  const avg = { kcal: Math.round(t.kcal / 7), p: r1(t.p / 7), f: r1(t.f / 7), c: r1(t.c / 7) }
  return { ...avg, pct: macroPct(avg), week: t }
})()

// 一周采购清单：按食材汇总克数（油脂类合并成一行，按瓶买）
export const KETO_SHOPPING = (() => {
  const grams = {}
  for (const d of WEEK_RAW) for (const s of MEAL_SLOTS) for (const [k, g] of d[s.key].items) grams[k] = (grams[k] || 0) + g
  const groups = {}
  for (const [k, g] of Object.entries(grams)) {
    const food = FOODS[k]
    const text = k === 'egg' ? `${food.name} ${g / 50} 个` : `${food.name} ${g >= 1000 ? `${r1(g / 1000)}kg` : `${g}g`}`
    ;(groups[food.cat] ||= []).push(text)
  }
  return ['蛋白质', '奶蛋豆', '蔬菜', '脂肪/坚果'].filter(c => groups[c]).map(c => ({ group: c, items: groups[c].join('、') }))
})()

export const KETO_TARGETS = [
  { label: '日均热量', value: `${KETO_WEEK_AVG.kcal} kcal`, note: `减脂参考 ${KETO_PROFILE.kcalRange.join('–')}（每天约 300–500 缺口）` },
  { label: '日均蛋白质', value: `${KETO_WEEK_AVG.p} g`, note: `目标 1.2–1.6 g/kg（${KETO_PROFILE.weightKg}kg ≈ ${KETO_PROFILE.proteinRange.join('–')}g）` },
  { label: '日均脂肪', value: `${KETO_WEEK_AVG.f} g`, note: '橄榄油/牛油果/坚果/鱼油为主' },
  { label: '日均净碳水', value: `${KETO_WEEK_AVG.c} g`, note: `每天 ≤ ${KETO_PROFILE.netCarbMax}g，前 2 周压到 25g 内更易入酮` },
  { label: '饮水 & 电解质', value: '2.5–3 L', note: '另加盐 + 钾 + 镁，防「酮流感」' },
]

export const KETO_MACRO_COLORS = { f: '#F59E0B', p: '#3B82F6', c: '#10B981' }
export const KETO_MACROS = [
  { label: '脂肪', pct: KETO_WEEK_AVG.pct.f, color: KETO_MACRO_COLORS.f },
  { label: '蛋白质', pct: KETO_WEEK_AVG.pct.p, color: KETO_MACRO_COLORS.p },
  { label: '碳水', pct: KETO_WEEK_AVG.pct.c, color: KETO_MACRO_COLORS.c },
]

export const KETO_EAT = [
  { title: '放心吃', color: '#10B981', items: ['肉蛋鱼虾、带皮禽肉', '豆腐、豆干、无糖豆浆', '绿叶菜、菌菇、瓜类、花菜西兰花', '牛油果、橄榄、坚果、奇亚籽', '橄榄油、猪油、黄油、芝士'] },
  { title: '少量吃', color: '#F59E0B', items: ['番茄、洋葱、胡萝卜、白萝卜', '蓝莓/草莓（每天一小把）', '无糖希腊酸奶、85%+ 黑巧', '腰果（碳水偏高）'] },
  { title: '不要吃', color: '#EF4444', items: ['米饭、面条、馒头、饼、粥', '糖、甜饮、果汁、大部分水果', '土豆、红薯、山药、藕、玉米', '勾芡、糖醋、红烧加糖、甜辣酱', '啤酒、甜酒；「低脂」加工食品'] },
]

export const KETO_TIPS = [
  { title: '电解质（最重要）', text: '每天多吃 1–2 小勺盐（喝汤/淡盐水）；牛油果、绿叶菜补钾；睡前镁剂 200–400mg。头晕、乏力、抽筋、心慌基本都是缺这三样。' },
  { title: '空气炸锅要点', text: '不裹淀粉/面包糠；腌料用盐、黑胡椒、孜然、辣椒粉、蒜粉，避开奥尔良、蜂蜜、大量蚝油；超市预制炸物别买。' },
  { title: '克数怎么用', text: '克数是可食部分生重。头两周用厨房秤称几次建立手感，之后目测即可。体重不是 70kg 就按比例增减肉量，蔬菜不用减。' },
  { title: '喝酒 & 熬夜', text: '啤酒一罐 10–13g 碳水，别喝；选烈酒（不兑甜饮）或干红干白，2–3 杯内。先吃肉垫底，中间喝水加盐，第二天照常吃。' },
  { title: '放纵餐', text: '前 4–6 周先不放纵；之后每 1–2 周一顿，火锅最划算——肉随便吃，碳水只挑一两样。第二天回到食谱，1–3 天恢复酮态。' },
  { title: '复查与边界', text: '执行 8–12 周后复查血脂（LDL 可能升高）、肝肾功能、尿酸，记到「健康 → 血液检查」。服降糖/降压药、有肾病/痛风/胆囊问题或孕哺期，先问医生。' },
]
