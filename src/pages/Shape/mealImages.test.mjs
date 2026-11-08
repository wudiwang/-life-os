import assert from 'node:assert/strict'
import test from 'node:test'
import { imagesFor, mealCards, imageName, bangkokTime } from './mealImages.js'
import { HAS_IMG } from './recipeCredits.js'

test('pictures follow the order foods are mentioned, max 3, CP chicken shows only the CP picture', () => {
  assert.deepEqual(imagesFor('Café Amazon 无糖黑咖啡 1 杯、肯德基吮指原味鸡 2 块（带皮）、CP 打抛嫩鸡胸 2 袋、鸡蛋 2 个、7-11 蔬菜沙拉 1 盒'), ['coffee', 'friedChicken', 'cp'])
  assert.deepEqual(imagesFor('CP 打抛嫩鸡胸 2 袋（160g）、鸡蛋 2 个（7-11）、7-11 蔬菜沙拉 1 盒', 5), ['cp', 'egg', 'salad'])
  assert.deepEqual(imagesFor('挪威青花鱼片 1 片 165g（空气炸锅）'), ['mackerel'])
  assert.deepEqual(imagesFor('混合坚果 20g、水煮蛋 2 个、牛油果果肉 100g'), ['almond', 'egg', 'avocado'])
  assert.deepEqual(imagesFor('空气炸锅牛排 300g + 西兰花'), ['beefLean', 'broccoli'])
  assert.deepEqual(imagesFor('不认识的东西'), [])
})

test('every picture key the matcher can return has an image file registered', () => {
  const all = ['cp', 'friedChicken', 'coffee', 'salad', 'egg', 'avocado', 'mackerel', 'almond', 'beefLean', 'broccoli', 'choySum', 'shrimp', 'salmon', 'seabass', 'chickenBreast', 'tofu', 'greekYogurt']
  for (const k of all) {
    assert.ok(HAS_IMG.has(k), `${k} 没有图片`)
    assert.ok(imageName(k), `${k} 没有名字`)
  }
})

test('meal cards are numbered by time, snacks are called 加餐, notes in brackets are dropped', () => {
  const cards = mealCards([
    { id: 'b', meal: 'dinner', items: '青花鱼 1 片（空气炸锅）', kcal: 338, protein_g: 31, created_at: '2026-11-07T11:44:00Z' },
    { id: 'a', meal: 'breakfast', items: '坚果 20g（可能含花生）、水煮蛋 2 个', kcal: 422, protein_g: 18, created_at: '2026-11-07T03:30:00Z' },
    { id: 's', meal: 'snack', items: '巴旦木 30g', kcal: 174, protein_g: 6, created_at: '2026-11-07T09:00:00Z' },
  ])
  assert.deepEqual(cards.map(c => c.title), ['第一顿', '加餐', '第二顿'])
  assert.equal(cards[0].text, '坚果 20g、水煮蛋 2 个')
  assert.equal(cards[0].time, '10:30') // 曼谷时间
  assert.equal(bangkokTime(null), '')
})
