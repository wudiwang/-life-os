import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReminder, slotFor, supplementsFor, ateFish } from './meal-reminder-core.mjs'

// 2026-11-08 的真实第一顿（KFC + CP + 蛋 + 咸鸭蛋 + 沙拉）
const TODAY = [{ meal: 'lunch', items: 'Café Amazon 无糖黑咖啡 1 杯、肯德基吮指原味鸡 2 块（带皮）、CP 打抛嫩鸡胸 2 袋、鸡蛋 2 个、咸鸭蛋 1 个、7-11 EZY FRESH Party Salad 1 盒', kcal: 1248, protein_g: 136, fat_g: 62, sat_fat_g: 13, net_carb_g: 30.5 }]

test('slot is picked from the clock when run by hand', () => {
  assert.equal(slotFor('09:30'), 'morning')
  assert.equal(slotFor('13:00'), 'lunch')
  assert.equal(slotFor('18:30'), 'dinner')
  assert.equal(slotFor('21:30'), 'night')
})

test('dinner reminder: what was eaten, what is missing, two concrete options, supplements', () => {
  const msg = buildReminder({ slot: 'dinner', today: TODAY, weekday: 7, now: '18:30' })
  assert.match(msg, /^🍽 晚饭提醒 · 18:30/)
  assert.match(msg, /今天已吃：1,248 kcal · 蛋白 136g · 脂肪 62g/)
  assert.match(msg, /脂肪还差 18g（目标 80–120g）/)
  assert.match(msg, /吃完 .+ · 脂肪 \d+g/)
  assert.match(msg, /还差：蛋白 14g · 热量离 1,500 差 252/)
  assert.match(msg, /净碳已经超了/)
  assert.match(msg, /1\. .+\n/)
  assert.match(msg, /2\. /)
  assert.match(msg, /鱼油 1 粒（今天没吃鱼）/)
  assert.ok(msg.split('\n').length <= 13, '手机一屏读完')
})

test('morning reminder shows yesterday and the baseline breakfast when nothing is logged yet', () => {
  const msg = buildReminder({ slot: 'morning', today: [], yesterday: TODAY, weekday: 1 })
  assert.match(msg, /昨天：1,248 kcal · 蛋白 136g（差 14g）/)
  assert.match(msg, /早餐 3 个蛋 \+ 1 袋 CP/)
  assert.match(msg, /B 族 1 片/)
})

test('night reminder gives only one quick option, done days say stop', () => {
  const night = buildReminder({ slot: 'night', today: TODAY, weekday: 7 })
  assert.match(night, /22:00 前补一样：/)
  assert.ok(!/二选一/.test(night))
  assert.match(night, /镁 2–3 片/)
  const done = buildReminder({ slot: 'night', today: [{ items: '牛排', kcal: 1700, protein_g: 160, fat_g: 90, sat_fat_g: 16, net_carb_g: 20 }], weekday: 7 })
  assert.match(done, /✅ 今天都到位了/)
})

test('supplements follow the list: zinc on Mon/Wed/Fri lunch, no fish oil after fish', () => {
  assert.deepEqual(supplementsFor('lunch', 3, false), ['柠檬酸钾 2 粒', '锌 1 片'])
  assert.deepEqual(supplementsFor('lunch', 2, false), ['柠檬酸钾 2 粒'])
  assert.deepEqual(supplementsFor('dinner', 2, true), ['柠檬酸钾 2 粒'])
  assert.equal(ateFish([{ items: '挪威青花鱼片 1 片 165g' }]), true)
  assert.equal(ateFish(TODAY), false)
})
