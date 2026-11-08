// 健康塑形第 1 期的目标（与 docs/健康塑形计划.md 保持一致，改数字两边一起改）。
// 2026-11-07 修订：脂肪改为上限（不是要吃够的门槛）、加饱和脂肪额度和每周有氧分钟。
export const SHAPE_PLAN = {
  title: '健康塑形 · 第 1 期',
  start: '2026-11-04',
  weeks: 12,
  profile: { heightCm: 180, age: 35, sex: 'male', weightKg: 90 },
  daily: {
    kcal: 1900,          // 摄入上限参考；±100 内都算达标
    kcalFloor: 1500,     // 底线：低于它就是吃太少（练过的日子更要补）
    protein: 150,        // 下限
    netCarb: 30,         // 上限（生酮）
    fat: 120,            // 上限：再多缺口就没了
    fatMin: 80,          // 下限：蛋白 150g + 碳水 30g 时，热量要到 1,500 约需 87g 脂肪；低于它就成了「高蛋白低热量」的蛋白节食
    satFat: 20,          // 上限（≈ 总热量 10%）；ApoB 偏高时收紧到 13–15
    steps: 8000,         // 下限
    sodiumMax: 3000,     // 钠（mg）建议上限：血压没测前别长期超
    potassiumMin: 3400,  // 钾（mg）下限：食物 + 补剂
    magnesiumMin: 420,   // 镁（mg）下限：食物 + 补剂
  },
  // 每天按清单吃的补剂（第二大脑「营养补剂清单」）：柠檬酸钾 6 粒、镁 2 片起
  supplements: { potassium: 594, magnesium: 200 },
  weekly: { strength: 3, aerobicMin: 150 }, // 有氧 = 心率约 118–140 的坡度走/骑车/游泳，不含日常步数
}

export const MEALS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
]

export const WORKOUT_KINDS = { strength: '力量', cardio: '有氧', walk: '走路', other: '其他' }
