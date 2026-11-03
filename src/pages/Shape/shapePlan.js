// 健康塑形第 1 期的目标（与 docs/健康塑形计划.md 保持一致，改数字两边一起改）。
export const SHAPE_PLAN = {
  title: '健康塑形 · 第 1 期',
  start: '2026-11-04',
  weeks: 12,
  profile: { heightCm: 180, age: 35, sex: 'male', weightKg: 90 },
  daily: {
    kcal: 1900,          // 摄入上限参考；±100 内都算达标
    protein: 150,        // 下限
    netCarb: 30,         // 上限（生酮）
    steps: 8000,         // 下限
  },
  weekly: { strength: 3 },
}

export const MEALS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
]

export const WORKOUT_KINDS = { strength: '力量', cardio: '有氧', walk: '走路', other: '其他' }
