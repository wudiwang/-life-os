import assert from 'node:assert/strict'
import test from 'node:test'
import { remainingRows, suggest, amountFor, cpBagsEaten } from './shapeSuggest.js'

// 2026-11-07 真实一天：早餐 + 练后 7-11 + 晚餐青花鱼 1 片之后
const TODAY = { kcal: 1113, protein: 99, fat: 71, satFat: 15, netCarb: 12.5 }

test('rows show eaten / target / gap, fat is a cap not a goal', () => {
  const rows = Object.fromEntries(remainingRows(TODAY, null).map(r => [r.key, r]))
  assert.equal(rows.protein.gap, '还差 51g')
  assert.equal(rows.protein.status, 'short')
  assert.equal(rows.kcal.gap, '还差 387')
  assert.equal(rows.kcal.sub, '最多还能吃 787')
  assert.equal(rows.fat.status, 'room')
  assert.equal(rows.fat.gap, '还剩 49g 额度')
  assert.equal(rows.satFat.gap, '还剩 5g 额度')
  assert.equal(rows.steps.status, 'none')
})

test('unknown saturated fat is shown as not estimated, not as 0', () => {
  const rows = remainingRows({ kcal: 800, protein: 60, fat: 40, satFat: null, netCarb: 10 }, 9000)
  assert.equal(rows.find(r => r.key === 'satFat').eaten, '未估')
  assert.equal(rows.find(r => r.key === 'steps').status, 'ok')
})

test('amounts: CP by bag, mackerel by piece (max 2), others rounded up to 10g', () => {
  assert.equal(amountFor('cp', 51), 240)            // 3 袋 = 54g
  assert.equal(amountFor('chickenBreast', 51), 230) // 51.8g
  assert.equal(amountFor('beefLean', 51), 250)
  assert.equal(amountFor('mackerel', 51), 330)      // 2 片
  assert.equal(amountFor('mackerel', 200), 330)     // 封顶 2 片
})

test('counts CP bags already eaten from the logged text', () => {
  assert.equal(cpBagsEaten([{ items: 'CP 打抛嫩鸡胸 2 袋（160g）、鸡蛋 2 个' }, { items: '青花鱼 1 片' }]), 2)
  assert.equal(cpBagsEaten([]), 0)
})

test('today: protein short → options that cover 51g, add greens + oil when calories stay under 1500, flag what would go over', () => {
  const s = suggest(TODAY, { cpEaten: 2 })
  assert.equal(s.status, 'protein')
  assert.equal(s.need.p, 51)
  const chicken = s.options.find(o => o.key === 'chickenBreast')
  assert.ok(chicken.gain.p >= 51)
  assert.ok(chicken.side, '热量不到 1500 时应加配菜')
  assert.ok(chicken.after.kcal >= 1500 && chicken.after.p >= 150 && chicken.after.sfa <= 20)
  assert.deepEqual(chicken.warn, [])
  const cp = s.options.find(o => o.key === 'cp')
  assert.ok(cp.warn.some(w => w.includes('CP 会到 5 袋')))
  const fish = s.options.find(o => o.key === 'mackerel') // 会超饱和脂肪：要么不展示，要么带提醒
  assert.ok(!fish || fish.warn.some(w => w.includes('饱和脂肪')))
  const beef = s.options.find(o => o.key === 'beefLean')
  assert.ok(beef.side && !beef.side.includes('橄榄油'), '加油会超饱和脂肪时只配菜')
  // 不会超标的排在前面
  const firstWarn = s.options.findIndex(o => o.warn.length)
  assert.ok(s.options.slice(firstWarn).every(o => o.warn.length))
})

test('early in the day only one meal worth is suggested', () => {
  const s = suggest({ kcal: 422, protein: 18, fat: 35, satFat: 7, netCarb: 5.8 })
  assert.equal(s.status, 'protein')
  assert.match(s.note, /这一顿先补 60g/)
  assert.ok(s.options.every(o => o.gain.p < 80))
})

test('protein met but calories under the floor → small calorie add-ons', () => {
  const s = suggest({ kcal: 1300, protein: 155, fat: 60, satFat: 12, netCarb: 15 })
  assert.equal(s.status, 'kcal')
  assert.equal(s.need.kcal, 200)
  assert.ok(s.options.length >= 3)
})

test('all met → done; something over → over', () => {
  assert.equal(suggest({ kcal: 1700, protein: 160, fat: 95, satFat: 17, netCarb: 22 }).status, 'done')
  const s = suggest({ kcal: 1700, protein: 160, fat: 95, satFat: 24, netCarb: 22 })
  assert.equal(s.status, 'over')
  assert.deepEqual(s.over, ['饱和脂肪'])
  assert.equal(suggest({ kcal: 0, protein: 0, fat: 0, satFat: null, netCarb: 0 }).status, 'empty')
})

test('11-08: carbs already full and protein nearly met → a real 40g-protein meal with oil only, best-fitting first', () => {
  const s = suggest({ kcal: 1143, protein: 128, fat: 55, satFat: 11, netCarb: 29.2 }, { cpEaten: 2 })
  assert.equal(s.status, 'protein')
  assert.equal(s.need.p, 22)
  const top = s.options[0]
  assert.equal(top.key, 'beefLean')               // 唯一能吃到 1500 的精瘦选项
  assert.ok(top.gain.p >= 40)
  assert.equal(top.side, '橄榄油 15g')             // 加菜会超碳水，只淋油
  assert.ok(top.after.kcal >= 1500 && top.after.c <= 30 && top.after.sfa <= 20)
  assert.ok(s.options.find(o => o.key === 'cp').warn.length) // 再吃 3 袋 CP 就 5 袋
})
