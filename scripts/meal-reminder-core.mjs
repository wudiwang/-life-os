// 大仙的「吃饭提醒」文案：纯函数。输入今天 / 昨天的饮食记录、时段、星期，输出一条 TG 消息。
// 数字和建议跟首页同一套算法（src/pages/Shape/shapeSuggest.js），不经过 AI，秒发、不会估错。
// 测试见 meal-reminder-core.test.mjs；发送和定时在 meal-reminder.mjs / install-launchd.sh。
import { sumFood } from '../src/pages/Shape/shapeCalc.js'
import { suggest, cpBagsEaten, fleshEaten, wheyScoopsEaten, ateNuts, LIMITS } from '../src/pages/Shape/shapeSuggest.js'
import { BASELINE_DAY, sumItems } from '../src/pages/Shape/shapeRecipe.js'
import { imagesFor } from '../src/pages/Shape/mealImages.js'

// 2026-11-12 起一天两顿，进食窗口约 12:00–20:00：第一顿前、第二顿前、窗口关闭前各一条
export const SLOTS = {
  first: { time: '11:45', title: '🍳 第一顿' },
  second: { time: '18:15', title: '🍽 第二顿' },
  close: { time: '19:45', title: '⏰ 窗口快关了' },
}

// 两顿的基线：直接取食谱页的基线日（shapeRecipe.BASELINE_DAY），数字现算，提醒和食谱页不会对不上。
// 2026-11-13 起不再生酮：每顿都带一份主食。
const baseline = meal => {
  const s = sumItems(meal.items)
  return `${meal.brief}（约 ${Math.round(s.kcal / 10) * 10} kcal · 蛋白 ${Math.round(s.p)}g · 碳水 ${Math.round(s.c)}g）`
}
const FIRST_MEAL = baseline(BASELINE_DAY.meals[0])
const SECOND_MEAL = baseline(BASELINE_DAY.meals[1])

// 手动运行时按当前时间猜时段
export function slotFor(hhmm) {
  if (hhmm < '15:00') return 'first'
  if (hhmm < '19:30') return 'second'
  return 'close'
}

const fmt = n => Math.round(Number(n) || 0).toLocaleString('zh-CN')

// 今天有没有吃多脂鱼（吃了就不用鱼油）
export const ateFish = rows => rows.some(r => imagesFor(r.items, 9).some(k => k === 'mackerel' || k === 'salmon'))

// 这个时段该吃的补剂（对应第二大脑「营养补剂清单」）。weekday：1=周一 … 7=周日；锌在一、三、五
// 柠檬酸钾一天 6 粒，两顿各 3 粒随饭吃
// 洋车前子壳一天 10g（降 LDL / ApoB），两顿饭前各 5g；排在最前，因为它要先喝，其余的饭后吞
// B 族 2026-11-13 起不再每天提醒：主食、蛋、豆、酸奶吃回来以后食物里够了
const PSYLLIUM = '洋车前子 5g（饭前冲 300ml 水马上喝）'
export function supplementsFor(slot, weekday, fish) {
  if (slot === 'first') return [PSYLLIUM, '柠檬酸钾 3 粒（随饭）', ...([1, 3, 5].includes(weekday) ? ['锌 1 片'] : [])]
  if (slot === 'second') return [PSYLLIUM, '柠檬酸钾 3 粒（随饭）', ...(fish ? [] : ['鱼油 1 粒（今天没吃鱼）'])]
  return ['镁 2–3 片（睡前）']
}

function optionLine(o, i) {
  const main = `${i + 1}. ${o.main}${o.side ? ` + ${o.side}` : ''}`
  return `${main}（吃完 ${fmt(o.after.kcal)} kcal · 蛋白 ${fmt(o.after.p)}g · 碳水 ${fmt(o.after.c)}g · 脂肪 ${fmt(o.after.f)}g）${o.warn[0] ? `\n   ⚠ ${o.warn[0]}` : ''}`
}

export function buildReminder({ slot, today, yesterday = [], weekday, now = SLOTS[slot].time }) {
  const lines = [`${SLOTS[slot].title} · ${now}`]
  const t = sumFood(today)

  if (slot === 'first' && yesterday.length) {
    const y = sumFood(yesterday)
    const pGap = LIMITS.protein - y.protein
    lines.push(`昨天：${fmt(y.kcal)} kcal · 蛋白 ${fmt(y.protein)}g${pGap > 0 ? `（差 ${fmt(pGap)}g）` : ' ✓'} · 碳水 ${fmt(y.netCarb)}g · 脂肪 ${fmt(y.fat)}g`)
  }

  if (!today.length) {
    if (slot === 'first') lines.push(`第一顿照基线：${FIRST_MEAL}`)
    else if (slot === 'second') lines.push(`今天还没有饮食记录，第一顿吃了的话回我一句补上。第二顿照基线：${SECOND_MEAL}`)
    else lines.push('今天还没有饮食记录。吃了的话回我一句补上；20:00 前吃完，之后不再吃。')
  } else {
    lines.push(`今天已吃：${fmt(t.kcal)} kcal · 蛋白 ${fmt(t.protein)}g · 碳水 ${fmt(t.netCarb)}g · 脂肪 ${fmt(t.fat)}g`)
    const s = suggest(t, { cpEaten: cpBagsEaten(today), fleshEaten: fleshEaten(today), wheyEaten: wheyScoopsEaten(today), nutsEaten: ateNuts(today) })
    // 吃得偏少、今天已经没法再补的项（碳水、脂肪）：只在不用再吃的日子提一句，留给明天
    const low = s.low.length ? `📝 偏少：${s.low.join('、')}。${s.lowTip}` : null
    if (s.status === 'done') lines.push(slot === 'close' ? '✅ 今天都到位了，20:00 后只喝水。' : '✅ 蛋白、热量都到了，今天不用再吃。', ...(low ? [low] : []))
    else if (s.status === 'over') lines.push(`⚠ ${s.over.join('、')}超了，今天别再加。`, ...(low ? [low] : []))
    else {
      const need = s.status === 'protein'
        ? `还差：蛋白 ${fmt(s.need.p)}g${s.need.kcal > 0 ? ` · 热量离 ${fmt(LIMITS.kcalFloor)} 差 ${fmt(s.need.kcal)}` : ''}${t.netCarb < LIMITS.netCarbMin ? ` · 碳水离 ${LIMITS.netCarbMin}g 差 ${fmt(LIMITS.netCarbMin - t.netCarb)}g` : ''}`
        : `蛋白够了，热量离 ${fmt(LIMITS.kcalFloor)} 还差 ${fmt(s.need.kcal)}`
      lines.push(need)
      if (s.over.length) lines.push(`⚠ ${s.over.join('、')}已经超了，别再往上加`)
      const veg = s.fleshUsed ? '（今天肉和鱼够一份了，用豆腐、酸奶、蛋白粉补）' : ''
      if (slot === 'close') lines.push(`👉 20:00 前补一样${veg}：${optionLine(s.options[0], 0).slice(3)}`)
      else lines.push(`👉 二选一${veg}：`, ...s.options.slice(0, 2).map(optionLine))
    }
  }

  if (slot === 'close' && t.sodium != null && t.sodium > LIMITS.sodiumMax) lines.push(`🧂 今天钠约 ${fmt(t.sodium)}mg（建议 ≤ ${fmt(LIMITS.sodiumMax)}），多喝水，明天少吃咸的`)
  lines.push(`💊 ${supplementsFor(slot, weekday, ateFish(today)).join('、')}`)
  if (slot === 'first') lines.push('💧 先喝 500ml 水；今天目标 3–3.5L')
  if (slot === 'second') lines.push('⏰ 20:00 前吃完')
  if (slot === 'close') lines.push('💧 20:00 后只喝水、无糖茶；1 点前睡')
  lines.push('吃了什么回我一句就行，我来记。')
  return lines.join('\n')
}
