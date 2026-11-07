import assert from 'node:assert/strict'
import test from 'node:test'
import { RECIPE_FOODS, RECIPE_TARGETS, WEEK, BASELINE_DAY, PROTEIN_SWAPS, PROTEIN_UNIT, QA, sumItems, dayTotals, dayChecks, eggCount, amountLabel, shoppingList } from './shapeRecipe.js'

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
  assert.equal(RECIPE_TARGETS.protein, 150)
  assert.equal(RECIPE_TARGETS.netCarb, 30)
  assert.equal(RECIPE_TARGETS.fat, 120)
  assert.equal(RECIPE_TARGETS.satFat, 20)
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
  assert.equal(eggCount(BASELINE_DAY), 3)
  assert.equal(amountLabel('egg', 150), '3 个（150g）')
  assert.equal(amountLabel('cp', 240), '3 袋（240g）')
  assert.equal(amountLabel('avocado', 70), '半个（70g 果肉）')
  assert.equal(amountLabel('broccoli', 150), '150g')
  assert.equal(amountLabel('mackerel', 165), '1 片（165g）')
})

test('weekly shopping list sums grams and rounds countable items up', () => {
  const list = shoppingList([BASELINE_DAY, BASELINE_DAY])
  const cp = list.find(x => x.key === 'cp')
  assert.equal(cp.g, 640)
  assert.equal(cp.label, '8 袋（640g）')
  assert.equal(list[0].key === 'cp' || RECIPE_FOODS[list[0].key].kind === 'protein', true) // 蛋白排最前
  const avo = list.find(x => x.key === 'avocado')
  assert.equal(avo.label, '2 个（280g）')
})

test('Q&A covers fat, protein, sodium, potassium, magnesium and water', () => {
  const text = JSON.stringify(QA)
  for (const word of ['脂肪', '蛋白', '钠', '钾', '镁', '喝多少']) assert.ok(text.includes(word), word)
})
