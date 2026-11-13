// 健康塑形第 1 期的目标（与 docs/健康塑形计划.md 保持一致，改数字两边一起改）。
// 2026-11-07 修订：脂肪改为上限（不是要吃够的门槛）、加饱和脂肪额度和每周有氧分钟。
// 2026-11-13 修订：不再生酮，改成均衡低脂的减脂吃法——碳水吃回来（有下限）、脂肪和饱和脂肪收紧、
// 肉和鱼一天合计约一份，其余蛋白用蛋、豆腐、酸奶补。减脂靠的是热量缺口，这一点没变。
export const SHAPE_PLAN = {
  title: '健康塑形 · 第 1 期',
  start: '2026-11-04',
  weeks: 12,
  profile: { heightCm: 180, age: 35, sex: 'male', weightKg: 90 },
  daily: {
    kcal: 1900,          // 摄入上限参考；±100 内都算达标
    kcalFloor: 1600,     // 底线：低于它就是吃太少（练过的日子更要补）
    protein: 130,        // 下限
    netCarb: 130,        // 上限
    netCarbMin: 80,      // 下限：低于它就又滑回低碳 / 生酮了
    fat: 90,             // 上限：= 1,900 − 蛋白 − 碳水 剩下的部分
    fatMin: 60,          // 下限：每顿带一点脂肪，别吃成水煮一切
    satFat: 15,          // 上限
    steps: 8000,         // 下限
    sodiumMax: 3000,     // 钠（mg）建议上限：血压没测前别长期超
    potassiumMin: 3400,  // 钾（mg）下限：食物 + 补剂
    magnesiumMin: 420,   // 镁（mg）下限：食物 + 补剂
    fleshMax: 250,       // 肉 + 鱼 + 禽一天合计（生重 g），CP 鸡胸也算
  },
  // 2026-11-13 之前是生酮期：看那几天的记录时按当时的目标判断，不拿新目标去打叉
  dietSince: '2026-11-13',
  ketoDaily: { kcalFloor: 1500, protein: 150, netCarb: 30, netCarbMin: 0, fat: 120, fatMin: 80, satFat: 20, fleshMax: null },
  // 每天按清单吃的补剂（第二大脑「营养补剂清单」）：柠檬酸钾 6 粒、镁 2 片起
  supplements: { potassium: 594, magnesium: 200 },
  // 有氧 = 心率约 118–140 的坡度走/骑车/游泳，不含日常步数。2026-11-13 起每天坡度走 ≥ 40 分钟（心率约 130），一周 280 分钟
  weekly: { strength: 3, aerobicMin: 280, aerobicDailyMin: 40 },
}

// 某一天适用的每日目标
export const targetsFor = day => (day && day < SHAPE_PLAN.dietSince ? { ...SHAPE_PLAN.daily, ...SHAPE_PLAN.ketoDaily } : SHAPE_PLAN.daily)

export const MEALS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
]

export const WORKOUT_KINDS = { strength: '力量', cardio: '有氧', walk: '走路', other: '其他' }
