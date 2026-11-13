import assert from 'node:assert/strict'
import test from 'node:test'
import { suggest, amountFor, cpBagsEaten, fleshEaten, wheyScoopsEaten, ateNuts, limitsFrom, LIMITS, WHEY_DAILY } from './shapeSuggest.js'
import { targetsFor } from './shapePlan.js'

// 吃完基线第一顿（炒蛋 2 个 + CP 1 袋 + 蛋白粉 1 勺 + 糙米饭 150g + 菜心 + 橄榄油）之后
const AFTER_FIRST = { kcal: 676, protein: 64.3, fat: 25.3, satFat: 6, netCarb: 44.7 }

test('limits come from the plan: carbs have a floor, meat and fish have a daily allowance', () => {
  assert.equal(LIMITS.protein, 130)
  assert.equal(LIMITS.kcalFloor, 1600)
  assert.equal(LIMITS.netCarbMin, 80)
  assert.equal(LIMITS.netCarb, 130)
  assert.equal(LIMITS.fat, 90)
  assert.equal(LIMITS.satFat, 15)
  assert.equal(LIMITS.fleshMax, 250)
  const keto = limitsFrom(targetsFor('2026-11-08')) // 生酮期的旧日子按当时的目标
  assert.equal(keto.netCarb, 30)
  assert.equal(keto.netCarbMin, 0)
  assert.equal(keto.protein, 150)
})

test('amounts: CP by bag, mackerel by piece, others rounded up to 10g, all capped', () => {
  assert.equal(amountFor('cp', 51), 240)                 // 3 袋 = 54g
  assert.equal(amountFor('cp', 51, 160), 160)            // 肉鱼额度只剩 160g → 2 袋
  assert.equal(amountFor('chickenBreast', 51), 230)
  assert.equal(amountFor('chickenBreast', 70, 250), 250) // 封顶一份
  assert.equal(amountFor('mackerel', 51, 165), 165)      // 最多 1 片
  assert.equal(amountFor('whey', 60, 30), 30)            // 最多 1 勺
})

test('counts CP bags and estimates meat + fish already eaten from the logged text', () => {
  assert.equal(cpBagsEaten([{ items: 'CP 打抛嫩鸡胸 2 袋（160g）、鸡蛋 2 个' }, { items: '青花鱼 1 片' }]), 2)
  assert.equal(cpBagsEaten([]), 0)
  assert.equal(fleshEaten([{ items: '肯德基吮指原味鸡 2 块（带皮）、CP 打抛嫩鸡胸 2 袋、鸡蛋 2 个、咸鸭蛋 1 个、沙拉 1 盒' }]), 280) // 炸鸡按一份 120g + CP 160g
  assert.equal(fleshEaten([{ items: '挪威青花鱼片 1 片 165g（空气炸锅）、西兰花 200g、鱼油 1 粒' }]), 165)
  assert.equal(fleshEaten([{ items: '五花肉 2 块、蘑菇几个' }, { items: '带油边牛排 200g（按生重）、煎牛排用油约 5g' }]), 320)
  assert.equal(fleshEaten([{ items: '炒蛋 2 个、豆腐 300g、糙米饭 150g' }]), 0)
})

test('counts protein powder scoops and notices nuts from the logged text', () => {
  assert.equal(WHEY_DAILY, 2)
  assert.equal(ateNuts([{ items: '鸡胸 170g、红薯 250g、夏威夷果 20g' }]), true)
  assert.equal(ateNuts([{ items: '炒蛋 2 个、糙米饭 150g' }]), false)
  assert.equal(wheyScoopsEaten([]), 0)
  assert.equal(wheyScoopsEaten([{ items: '炒蛋 2 个、豆腐 300g、无糖希腊酸奶 200g' }]), 0)
  assert.equal(wheyScoopsEaten([{ items: '青花鱼 1 片、红薯 250g、蛋白粉 1 勺（30g）' }]), 1)
  assert.equal(wheyScoopsEaten([{ items: '乳清蛋白粉半勺、香蕉 1 根' }, { items: '蛋白粉冲水' }]), 1.5) // 没写勺数按 1 勺
  assert.equal(wheyScoopsEaten([{ items: '燕麦 50g、蛋白粉 2 勺' }]), 2)
})

test('second meal after the baseline first meal: meat capped by what is left, the second scoop of protein powder tops up (tofu once both are had), rice, greens and the daily nuts fill carbs and calories', () => {
  const s = suggest(AFTER_FIRST, { cpEaten: 1, fleshEaten: 80, wheyEaten: 1 })
  assert.equal(s.status, 'protein')
  assert.equal(s.need.p, 65.7)
  assert.equal(s.need.kcal, 924)
  assert.equal(s.options[0].key, 'chickenBreast')
  const chicken = s.options.find(o => o.key === 'chickenBreast')
  assert.equal(chicken.main, '生鸡胸肉 170g + 乳清蛋白粉 1 勺（30g）') // 250 − 80 = 170g；今天的第二勺还没喝
  assert.match(chicken.side, /糙米饭/)
  assert.match(chicken.side, /夏威夷果 20g/) // 今天还没吃坚果，热量又不够，放进这一顿
  const nuts = suggest(AFTER_FIRST, { cpEaten: 1, fleshEaten: 80, wheyEaten: 1, nutsEaten: true })
  assert.ok(nuts.options.every(o => o.items.every(([k]) => k !== 'macadamia')), '吃过坚果就不再放')
  assert.match(nuts.options.find(o => o.key === 'chickenBreast').side, /糙米饭 200g/) // 改用主食补到 200g
  assert.ok(chicken.after.kcal >= 1550 && chicken.after.p >= 130)
  assert.ok(chicken.after.c >= 80 && chicken.after.c <= 130 && chicken.after.f <= 90 && chicken.after.sfa <= 15)
  assert.deepEqual(chicken.warn, [])
  const tofu = s.options.find(o => o.key === 'tofu')
  assert.equal(tofu.main, '北豆腐 300g + 乳清蛋白粉 1 勺（30g）')
  assert.ok(s.options.every(o => o.items.filter(([k]) => k === 'whey').length <= 1), '一个选项里最多 1 勺')
  // 今天的 2 勺喝满了：回到豆腐 / 酸奶补，也不再给「蛋白粉」这个选项
  const had = suggest(AFTER_FIRST, { cpEaten: 1, fleshEaten: 80, wheyEaten: 2 })
  assert.equal(had.options.find(o => o.key === 'chickenBreast').main, '生鸡胸肉 170g + 北豆腐 250g')
  assert.match(had.options.find(o => o.key === 'tofu').main, /北豆腐 300g \+ 无糖希腊酸奶 200g/)
  assert.ok(had.options.every(o => o.items.every(([k]) => k !== 'whey')))
  // 不会超标的排在前面
  const firstWarn = s.options.findIndex(o => o.warn.length)
  assert.ok(firstWarn < 0 || s.options.slice(firstWarn).every(o => o.warn.length))
  // 一天一份肉鱼：所有带肉 / 鱼的选项加上已吃的都不超过 250g
  for (const o of s.options.filter(o => o.flesh)) assert.ok(o.items[0][1] + 80 <= 250, o.main)
})

test('early in the day only one meal worth is suggested', () => {
  const s = suggest({ kcal: 422, protein: 18, fat: 35, satFat: 7, netCarb: 5.8 }, { fleshEaten: 0 })
  assert.equal(s.status, 'protein')
  assert.match(s.note, /这一顿先补 70g/)
  assert.ok(s.options.every(o => o.gain.p < 90))
  assert.ok(s.low.some(l => l.startsWith('碳水')))
})

test('meat and fish allowance used up → only tofu / yogurt / protein powder options', () => {
  const s = suggest({ kcal: 900, protein: 95, fat: 45, satFat: 11, netCarb: 20 }, { cpEaten: 3, fleshEaten: 300 })
  assert.equal(s.status, 'protein')
  assert.deepEqual(s.options.map(o => o.key), ['tofu', 'whey'])
  assert.match(s.note, /肉和鱼已经够一份了/)
  assert.equal(s.fleshUsed, true)
  assert.match(s.options[0].side, /糙米饭/)
  const had = suggest({ kcal: 900, protein: 95, fat: 45, satFat: 11, netCarb: 20 }, { cpEaten: 3, fleshEaten: 300, wheyEaten: 2 })
  assert.deepEqual(had.options.map(o => o.key), ['tofu'])
  assert.ok(!/蛋白粉/.test(had.note))
})

test('protein met but calories under the floor → staple first when carbs are short, otherwise greens, avocado, nuts', () => {
  const lowCarb = suggest({ kcal: 1400, protein: 135, fat: 60, satFat: 12, netCarb: 50 })
  assert.equal(lowCarb.status, 'kcal')
  assert.equal(lowCarb.need.kcal, 200)
  assert.equal(lowCarb.options[0].key, 'rice')
  assert.equal(lowCarb.options[0].main, '糙米饭 150g') // 名字不带括号备注
  const carbOk = suggest({ kcal: 1400, protein: 135, fat: 50, satFat: 12, netCarb: 100 })
  assert.match(carbOk.options[0].main, /^菜心 200g \+ 橄榄油 10g/)
  assert.ok(carbOk.options[0].after.kcal >= 1550, '差得多时再叠一样小的，尽量吃到底线')
  assert.ok(carbOk.options.length >= 3)
})

test('all met → done; something over → over; carbs too low is noted for tomorrow', () => {
  assert.equal(suggest({ kcal: 1700, protein: 136, fat: 65, satFat: 14, netCarb: 120 }).status, 'done')
  const s = suggest({ kcal: 1700, protein: 140, fat: 70, satFat: 19, netCarb: 40 })
  assert.equal(s.status, 'over')
  assert.deepEqual(s.over, ['饱和脂肪'])
  assert.equal(s.low.length, 1)
  assert.match(s.low[0], /^碳水 40g（目标 80–130g）/)
  assert.equal(s.lowTip, '明天每顿带一份主食')
  assert.deepEqual(suggest({ kcal: 2100, protein: 140, fat: 95, satFat: 14, netCarb: 140 }).over, ['热量', '脂肪', '碳水'])
  assert.equal(suggest({ kcal: 0, protein: 0, fat: 0, satFat: null, netCarb: 0 }).status, 'empty')
})

test('a tight saturated-fat budget is flagged instead of silently exceeded', () => {
  const s = suggest({ kcal: 1100, protein: 90, fat: 60, satFat: 14, netCarb: 70 }, { fleshEaten: 100 })
  assert.equal(s.options[0].key, 'chickenBreast')
  assert.deepEqual(s.options[0].warn, [])
  assert.ok(s.options.find(o => o.key === 'tofu').warn.some(w => w.includes('饱和脂肪')))
})

test('old keto days keep keto rules: carbs capped at 30g, so no staple is suggested', () => {
  const s = suggest({ kcal: 1143, protein: 128, fat: 55, satFat: 11, netCarb: 29.2 }, { cpEaten: 2, L: limitsFrom(targetsFor('2026-11-08')) })
  assert.equal(s.status, 'protein')
  assert.equal(s.need.p, 22)
  assert.ok(s.options.every(o => !o.side || !/糙米饭|香蕉/.test(o.side)))
  assert.deepEqual(s.low, ['脂肪 55g（目标 80–120g）']) // 碳水没有下限，不提
})
