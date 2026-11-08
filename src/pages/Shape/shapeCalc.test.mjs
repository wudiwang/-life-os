import assert from 'node:assert/strict'
import test from 'node:test'
import { addDays, weekOf, sumFood, aerobicMinutes, bmr, weightOn, energyBalance, dayChecks, weekSummary, weightTrend, planDay } from './shapeCalc.js'

const profile = { heightCm: 180, age: 35, sex: 'male' }

test('date helpers stay on the calendar day and weeks start on Monday', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  const w = weekOf('2026-11-05') // 周四
  assert.equal(w[0], '2026-11-02')
  assert.equal(w[6], '2026-11-08')
  assert.equal(weekOf('2026-11-08')[0], '2026-11-02') // 周日仍属本周
  assert.equal(planDay('2026-11-04'), 1)
  assert.equal(planDay('2026-11-10'), 7)
})

test('food totals ignore empty values', () => {
  assert.deepEqual(sumFood([{ kcal: 500, protein_g: 40, fat_g: 30, net_carb_g: 5.25 }, { kcal: '300', protein_g: null, net_carb_g: '' }]),
    { kcal: 800, protein: 40, fat: 30, satFat: null, netCarb: 5.3, sodium: null, potassium: null, magnesium: null })
})

test('saturated fat is null until some row records it, then sums like the rest', () => {
  assert.equal(sumFood([{ kcal: 500, sat_fat_g: null }, { kcal: 300 }]).satFat, null)
  assert.equal(sumFood([{ sat_fat_g: 0 }]).satFat, 0) // 明确填了 0 就是 0，不是未记录
  assert.equal(sumFood([{ sat_fat_g: 8.4 }, { sat_fat_g: '6' }, { kcal: 200 }]).satFat, 14)
})

test('electrolytes add up per day and stay null until recorded', () => {
  const t = sumFood([{ sodium_mg: 4660, potassium_mg: 2100, magnesium_mg: 175 }, { sodium_mg: 120, potassium_mg: '600' }, { kcal: 30 }])
  assert.equal(t.sodium, 4780)
  assert.equal(t.potassium, 2700)
  assert.equal(t.magnesium, 175)
})

test('aerobic minutes count cardio and walks, not strength', () => {
  assert.equal(aerobicMinutes([{ kind: 'cardio', duration_min: 40 }, { kind: 'walk', duration_min: '25' }, { kind: 'strength', duration_min: 50 }, { kind: 'cardio' }]), 65)
  assert.equal(aerobicMinutes([]), 0)
})

test('BMR uses Mifflin-St Jeor', () => {
  assert.equal(bmr({ ...profile, weightKg: 90 }), 1855)
})

test('latest weight on or before the day, else the plan baseline', () => {
  const rows = [{ log_date: '2026-11-04', weight_kg: 90.2 }, { log_date: '2026-11-06', weight_kg: 89.6 }, { log_date: '2026-11-05' }]
  assert.equal(weightOn(rows, '2026-11-05'), 90.2)
  assert.equal(weightOn(rows, '2026-11-07'), 89.6)
  assert.equal(weightOn(rows, '2026-11-01'), 90)
})

test('energy balance prefers watch active energy and never double counts workouts', () => {
  const food = [{ kcal: 1900 }]
  const workouts = [{ kind: 'strength', kcal: 250 }]
  const watch = energyBalance({ food, workouts, daily: { active_kcal: 600, steps: 9000 }, weightKg: 90, profile })
  assert.equal(watch.base, 2041)
  assert.equal(watch.activity, 600)
  assert.equal(watch.activitySource, 'watch')
  assert.equal(watch.deficit, 2041 + 600 - 1900)
  const est = energyBalance({ food, workouts, daily: { steps: 8000 }, weightKg: 90, profile })
  assert.equal(est.activity, 250 + 360)
  assert.equal(est.activitySource, 'estimate')
})

test('day checks treat missing data as not recorded rather than failed', () => {
  const none = dayChecks({ food: [], workouts: [], daily: null })
  assert.deepEqual(none, { kcal: null, protein: null, netCarb: null, fat: null, satFat: null, steps: null, trained: false })
  const ok = dayChecks({ food: [{ kcal: 1980, protein_g: 152, fat_g: 118, sat_fat_g: 19, net_carb_g: 22 }], workouts: [{ kind: 'strength' }], daily: { steps: 8100 } })
  assert.deepEqual(ok, { kcal: true, protein: true, netCarb: true, fat: true, satFat: true, steps: true, trained: true })
  const bad = dayChecks({ food: [{ kcal: 2100, protein_g: 120, fat_g: 150, sat_fat_g: 35, net_carb_g: 45 }], workouts: [{ kind: 'walk' }], daily: { steps: 3000 } })
  assert.deepEqual(bad, { kcal: false, protein: false, netCarb: false, fat: false, satFat: false, steps: false, trained: false })
  // 老记录没估饱和脂肪：显示「未记录」而不是达标
  assert.equal(dayChecks({ food: [{ kcal: 1800, fat_g: 100 }], workouts: [], daily: null }).satFat, null)
})

test('week summary counts training and protein days within Monday-Sunday', () => {
  const s = weekSummary({
    day: '2026-11-05',
    foodRows: [{ log_date: '2026-11-04', protein_g: 155 }, { log_date: '2026-11-05', protein_g: 100 }, { log_date: '2026-11-01', protein_g: 200 }],
    workoutRows: [{ log_date: '2026-11-04', kind: 'strength' }, { log_date: '2026-11-06', kind: 'strength' }, { log_date: '2026-11-09', kind: 'strength' },
      { log_date: '2026-11-03', kind: 'cardio', duration_min: 40 }, { log_date: '2026-11-08', kind: 'walk', duration_min: 30 }, { log_date: '2026-11-10', kind: 'cardio', duration_min: 60 }],
    dailyRows: [{ log_date: '2026-11-04', weight_kg: 90 }, { log_date: '2026-11-05', weight_kg: 89 }],
  })
  assert.equal(s.days.length, 7)
  assert.equal(s.strength, 2)
  assert.equal(s.aerobicMin, 70) // 11-10 属下一周，不算
  assert.equal(s.proteinDays, 1)
  assert.equal(s.loggedDays, 5) // 11-03、11-04、11-05、11-06、11-08
  assert.equal(s.avgWeight, 89.5)
})

test('weight trend starts at the first weigh-in and smooths with a 7-day average', () => {
  const rows = [{ log_date: '2026-11-04', weight_kg: 90 }, { log_date: '2026-11-05', weight_kg: 89 }, { log_date: '2026-11-07', weight_kg: 88.6 }]
  const t = weightTrend(rows, '2026-11-07', 30)
  assert.equal(t[0].x, '2026-11-04')
  assert.equal(t.length, 4)
  assert.equal(t[2].y, null)
  assert.equal(t[2].avg, 89.5)
  assert.equal(t[3].avg, 89.2)
  assert.deepEqual(weightTrend([], '2026-11-07'), [])
})
