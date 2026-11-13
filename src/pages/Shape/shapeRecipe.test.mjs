import assert from 'node:assert/strict'
import test from 'node:test'
import { RECIPE_FOODS, RECIPE_TARGETS, WEEK, BASELINE_DAY, PROTEIN_SWAPS, PROTEIN_UNIT, QA, sumItems, dayTotals, dayChecks, eggCount, fleshGrams, amountLabel, shoppingList } from './shapeRecipe.js'

test('CP chicken matches the pack label: 80g bag = 90 kcal, 18g protein, 1.5g fat, 1g carb', () => {
  assert.deepEqual(sumItems([['cp', 80]]), { kcal: 90, p: 18, f: 1.5, sfa: 0, c: 1 })
})

test('every day of the week hits every target', () => {
  assert.equal(WEEK.length, 7)
  assert.equal(WEEK[0], BASELINE_DAY)
  for (const d of WEEK) {
    const failed = Object.entries(dayChecks(d)).filter(([, ok]) => !ok).map(([k]) => k)
    assert.deepEqual(failed, [], `${d.day} ${d.theme} 未达标：${failed.join(',')} ${JSON.stringify(dayTotals(d))}`)
  }
})

test('the targets are the shape plan numbers', () => {
  assert.equal(RECIPE_TARGETS.protein, 130)
  assert.equal(RECIPE_TARGETS.netCarbMin, 80)
  assert.equal(RECIPE_TARGETS.netCarb, 130)
  assert.equal(RECIPE_TARGETS.fatMin, 60)
  assert.equal(RECIPE_TARGETS.fat, 90)
  assert.equal(RECIPE_TARGETS.satFat, 15)
  assert.equal(RECIPE_TARGETS.fleshMax, 250)
})

test('two meals a day, each with a staple; no shellfish; meat and fish stay within one portion', () => {
  for (const d of WEEK) {
    assert.deepEqual(d.meals.map(m => m.slot), ['first', 'second'], d.day)
    for (const m of d.meals) {
      assert.ok(m.brief, `${d.day} ${m.slot} 缺提醒用的一句话`)
      assert.ok(m.items.some(([k]) => RECIPE_FOODS[k].kind === 'carb'), `${d.day} ${m.slot} 没有主食或水果`)
      assert.ok(!m.items.some(([k]) => k === 'shrimp'), `${d.day} ${m.slot} 有虾`)
    }
    assert.ok(fleshGrams(d) <= 250, `${d.day} 肉鱼 ${fleshGrams(d)}g`)
  }
  assert.equal(fleshGrams(BASELINE_DAY), 250) // CP 1 袋 80g + 鸡胸 170g
  // 2026-11-13 起：每天蛋白粉 2 勺（每顿 1 勺）、夏威夷果 20g
  for (const d of WEEK) {
    for (const m of d.meals) assert.deepEqual(m.items.filter(([k]) => k === 'whey').map(([, g]) => g), [30], `${d.day} ${m.slot} 蛋白粉不是 1 勺`)
    const nuts = d.meals.flatMap(m => m.items).filter(([k]) => k === 'macadamia').map(([, g]) => g)
    assert.deepEqual(nuts, [20], `${d.day} 夏威夷果不是 20g`)
  }
  // 碳水太少（又滑回低碳）或肉鱼太多都不算达标
  const lowCarb = { meals: BASELINE_DAY.meals.map(m => ({ ...m, items: m.items.filter(([k]) => RECIPE_FOODS[k].kind !== 'carb') })) }
  assert.equal(dayChecks(lowCarb).netCarb, false)
  const meaty = { meals: [{ slot: 'first', items: [...BASELINE_DAY.meals[0].items, ['chickenBreast', 100]] }, BASELINE_DAY.meals[1]] }
  assert.equal(dayChecks(meaty).flesh, false)
})

test('every food used has nutrition and saturated fat, every meal has a time and method', () => {
  for (const d of WEEK) for (const m of d.meals) {
    assert.ok(m.time && m.name && m.how, `${d.day} ${m.slot}`)
    for (const [k, g] of m.items) {
      assert.ok(RECIPE_FOODS[k], k)
      assert.equal(typeof RECIPE_FOODS[k].sfa, 'number', `${k} 缺饱和脂肪`)
      assert.ok(g > 0)
    }
  }
})

test('protein swaps are each about one portion (18g protein)', () => {
  for (const s of PROTEIN_SWAPS) {
    const p = sumItems([[s.key, s.g]]).p
    assert.ok(Math.abs(p - PROTEIN_UNIT) <= 1, `${s.key} ${s.g}g = ${p}g 蛋白`)
  }
})

test('eggs are counted from grams and labels read naturally', () => {
  assert.equal(eggCount(BASELINE_DAY), 2)
  assert.equal(amountLabel('egg', 150), '3 个（150g）')
  assert.equal(amountLabel('cp', 240), '3 袋（240g）')
  assert.equal(amountLabel('avocado', 70), '半个（70g 果肉）')
  assert.equal(amountLabel('broccoli', 150), '150g')
  assert.equal(amountLabel('mackerel', 165), '1 片（165g）')
})

test('weekly shopping list sums grams and rounds countable items up', () => {
  const list = shoppingList([BASELINE_DAY, BASELINE_DAY])
  const cp = list.find(x => x.key === 'cp')
  assert.equal(cp.g, 160)
  assert.equal(cp.label, '2 袋（160g）')
  assert.equal(RECIPE_FOODS[list[0].key].kind, 'protein') // 蛋白排最前，其次主食、蔬菜、油
  const kinds = list.map(x => RECIPE_FOODS[x.key].kind)
  assert.ok(kinds.lastIndexOf('protein') < kinds.indexOf('carb') && kinds.lastIndexOf('carb') < kinds.indexOf('veg'))
  assert.equal(list.find(x => x.key === 'banana').label, '2 根（200g）')
  assert.equal(shoppingList(WEEK).find(x => x.key === 'rice').label, '1.3kg')
})

test('Q&A covers carbs, fat, protein, uric acid, sodium, potassium, magnesium and water — and no longer teaches keto', () => {
  const text = JSON.stringify(QA)
  for (const word of ['主食', '脂肪', '蛋白', '尿酸', '钠', '钾', '镁', '喝多少']) assert.ok(text.includes(word), word)
  for (const word of ['生酮流感', '防弹咖啡', '多吃油']) assert.ok(!text.includes(word), word)
})
