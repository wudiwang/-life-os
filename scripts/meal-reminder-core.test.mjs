import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReminder, slotFor, supplementsFor, ateFish } from './meal-reminder-core.mjs'

// 照基线吃完的第一顿
const FIRST = [{ meal: 'lunch', items: '炒蛋 2 个、CP 打抛嫩鸡胸 1 袋、蛋白粉 1 勺、糙米饭 150g、菜心 200g、橄榄油 10g', kcal: 676, protein_g: 64, fat_g: 25, sat_fat_g: 6, net_carb_g: 45 }]
// 2026-11-08 的真实第一顿（KFC + CP + 蛋 + 咸鸭蛋 + 沙拉）：肉吃多了、几乎没有碳水
const MEATY = [{ meal: 'lunch', items: 'Café Amazon 无糖黑咖啡 1 杯、肯德基吮指原味鸡 2 块（带皮）、CP 打抛嫩鸡胸 2 袋、鸡蛋 2 个、咸鸭蛋 1 个、7-11 EZY FRESH Party Salad 1 盒', kcal: 1248, protein_g: 136, fat_g: 62, sat_fat_g: 13, net_carb_g: 30.5 }]

test('slot is picked from the clock when run by hand (two meals a day)', () => {
  assert.equal(slotFor('11:45'), 'first')
  assert.equal(slotFor('14:30'), 'first')
  assert.equal(slotFor('18:15'), 'second')
  assert.equal(slotFor('19:45'), 'close')
  assert.equal(slotFor('23:00'), 'close')
})

test('second-meal reminder: what was eaten, what is missing (carbs included), two concrete options with a staple, supplements', () => {
  const msg = buildReminder({ slot: 'second', today: FIRST, weekday: 5, now: '18:15' })
  assert.match(msg, /^🍽 第二顿 · 18:15/)
  assert.match(msg, /今天已吃：676 kcal · 蛋白 64g · 碳水 45g · 脂肪 25g/)
  assert.match(msg, /还差：蛋白 66g · 热量离 1,600 差 924 · 碳水离 80g 差 35g/)
  assert.match(msg, /1\. 生鸡胸肉 170g \+ 乳清蛋白粉 1 勺（30g） \+ 糙米饭 150g .+ 夏威夷果 20g/) // 肉鱼额度 250g，已吃 1 袋 CP；第二勺蛋白粉和今天的夏威夷果都还没吃
  const had = buildReminder({ slot: 'second', today: [{ ...FIRST[0], items: `${FIRST[0].items}、蛋白粉 1 勺、夏威夷果 20g` }], weekday: 5, now: '18:15' })
  assert.ok(!/蛋白粉|夏威夷果/.test(had.split('👉')[1]), '2 勺喝满、坚果吃过，就都不再放')
  assert.match(msg, /吃完 .+ · 碳水 \d+g · 脂肪 \d+g/)
  assert.match(msg, /2\. /)
  assert.match(msg, /鱼油 1 粒（今天没吃鱼）/)
  assert.match(msg, /20:00 前吃完/)
  assert.ok(!/净碳|生酮/.test(msg))
  assert.ok(msg.split('\n').length <= 13, '手机一屏读完')
})

test('after a meat-heavy first meal: no more meat, a staple instead', () => {
  const msg = buildReminder({ slot: 'second', today: MEATY, weekday: 7 })
  assert.match(msg, /蛋白够了，热量离 1,600 还差 352/)
  assert.match(msg, /1\. 糙米饭 150g/)
  assert.ok(!/鸡胸|鲈鱼|青花鱼|CP/.test(msg.split('👉')[1]))
  const short = buildReminder({ slot: 'second', today: [{ items: '鸡胸肉 300g、鸡蛋 2 个、生菜', kcal: 620, protein_g: 82, fat_g: 22, sat_fat_g: 6, net_carb_g: 6 }], weekday: 2 })
  assert.match(short, /二选一（今天肉和鱼够一份了，用豆腐、酸奶、蛋白粉补）：\n1\. 北豆腐 300g \+ 乳清蛋白粉 1 勺（30g）/)
  assert.ok(short.split('\n').length <= 13)
})

test('first-meal reminder shows yesterday and the baseline first meal (with a staple) when nothing is logged yet', () => {
  const msg = buildReminder({ slot: 'first', today: [], yesterday: MEATY, weekday: 1 })
  assert.match(msg, /^🍳 第一顿/)
  assert.match(msg, /昨天：1,248 kcal · 蛋白 136g ✓ · 碳水 31g · 脂肪 62g/)
  assert.match(msg, /第一顿照基线：炒蛋 2 个 \+ CP 1 袋 \+ 糙米饭 1 小碗（150g）\+ 菜心 \+ 蛋白粉 1 勺（约 680 kcal · 蛋白 64g · 碳水 45g）/)
  assert.ok(!/B 族/.test(msg))
  assert.match(msg, /锌 1 片/)
})

test('second-meal reminder with nothing logged gives the baseline second meal', () => {
  const msg = buildReminder({ slot: 'second', today: [], weekday: 2 })
  assert.match(msg, /第二顿照基线：鸡胸 170g \+ 红薯 250g \+ 西兰花蘑菇 \+ 蛋白粉 1 勺 \+ 香蕉 1 根 \+ 夏威夷果 20g/)
})

test('window-closing reminder gives only one quick option; done days say stop and note what ran low', () => {
  const close = buildReminder({ slot: 'close', today: MEATY, weekday: 7 })
  assert.match(close, /^⏰ 窗口快关了/)
  assert.match(close, /20:00 前补一样：糙米饭 150g/)
  assert.ok(!/二选一/.test(close))
  assert.match(close, /镁 2–3 片/)
  const salty = buildReminder({ slot: 'close', today: [{ ...MEATY[0], sodium_mg: 4660 }], weekday: 7 })
  assert.match(salty, /今天钠约 4,660mg（建议 ≤ 3,000）/)
  const done = buildReminder({ slot: 'close', today: [{ items: '鲈鱼 糙米饭 豆腐', kcal: 1700, protein_g: 140, fat_g: 70, sat_fat_g: 13, net_carb_g: 115 }], weekday: 7 })
  assert.match(done, /✅ 今天都到位了，20:00 后只喝水/)
  assert.ok(!/偏少/.test(done))
  const lowCarb = buildReminder({ slot: 'close', today: [{ items: '牛排', kcal: 1700, protein_g: 140, fat_g: 80, sat_fat_g: 14, net_carb_g: 20 }], weekday: 7 })
  assert.match(lowCarb, /📝 偏少：碳水 20g（目标 80–130g）。明天每顿带一份主食/)
})

test('supplements follow the list: psyllium before both meals, potassium split over two meals, zinc Mon/Wed/Fri, no fish oil after fish', () => {
  const psyllium = '洋车前子 5g（饭前冲 300ml 水马上喝）'
  assert.deepEqual(supplementsFor('first', 3, false), [psyllium, '柠檬酸钾 3 粒（随饭）', '锌 1 片'])
  assert.deepEqual(supplementsFor('first', 2, false), [psyllium, '柠檬酸钾 3 粒（随饭）'])
  assert.deepEqual(supplementsFor('second', 2, true), [psyllium, '柠檬酸钾 3 粒（随饭）'])
  assert.deepEqual(supplementsFor('second', 2, false), [psyllium, '柠檬酸钾 3 粒（随饭）', '鱼油 1 粒（今天没吃鱼）'])
  assert.deepEqual(supplementsFor('close', 2, false), ['镁 2–3 片（睡前）'])
  assert.equal(ateFish([{ items: '挪威青花鱼片 1 片 165g' }]), true)
  assert.equal(ateFish(MEATY), false)
})
