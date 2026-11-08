// 大仙的「吃饭提醒」文案：纯函数。输入今天 / 昨天的饮食记录、时段、星期，输出一条 TG 消息。
// 数字和建议跟首页同一套算法（src/pages/Shape/shapeSuggest.js），不经过 AI，秒发、不会估错。
// 测试见 meal-reminder-core.test.mjs；发送和定时在 meal-reminder.mjs / install-launchd.sh。
import { sumFood } from '../src/pages/Shape/shapeCalc.js'
import { suggest, cpBagsEaten, LIMITS } from '../src/pages/Shape/shapeSuggest.js'
import { imagesFor } from '../src/pages/Shape/mealImages.js'

export const SLOTS = {
  morning: { time: '09:30', title: '☀️ 早上好' },
  lunch: { time: '13:00', title: '🍱 午饭提醒' },
  dinner: { time: '18:30', title: '🍽 晚饭提醒' },
  night: { time: '21:30', title: '🌙 睡前收尾' },
}

// 手动运行时按当前时间猜时段
export function slotFor(hhmm) {
  if (hhmm < '11:00') return 'morning'
  if (hhmm < '16:00') return 'lunch'
  if (hhmm < '21:00') return 'dinner'
  return 'night'
}

const fmt = n => Math.round(Number(n) || 0).toLocaleString('zh-CN')

// 今天有没有吃多脂鱼（吃了就不用鱼油）
export const ateFish = rows => rows.some(r => imagesFor(r.items, 9).some(k => k === 'mackerel' || k === 'salmon'))

// 这个时段该吃的补剂（对应第二大脑「营养补剂清单」）。weekday：1=周一 … 7=周日；锌在一、三、五
export function supplementsFor(slot, weekday, fish) {
  if (slot === 'morning') return ['B 族 1 片', '柠檬酸钾 2 粒（随第一顿饭）']
  if (slot === 'lunch') return ['柠檬酸钾 2 粒', ...([1, 3, 5].includes(weekday) ? ['锌 1 片'] : [])]
  if (slot === 'dinner') return ['柠檬酸钾 2 粒', ...(fish ? [] : ['鱼油 1 粒（今天没吃鱼）'])]
  return ['镁 2–3 片（睡前）']
}

function optionLine(o, i) {
  const main = `${i + 1}. ${o.main}${o.side ? ` + ${o.side}` : ''}`
  return `${main}（吃完 ${fmt(o.after.kcal)} kcal · 蛋白 ${fmt(o.after.p)}g · 脂肪 ${fmt(o.after.f)}g）${o.warn[0] ? `\n   ⚠ ${o.warn[0]}` : ''}`
}

export function buildReminder({ slot, today, yesterday = [], weekday, now = SLOTS[slot].time }) {
  const lines = [`${SLOTS[slot].title} · ${now}`]
  const t = sumFood(today)

  if (slot === 'morning' && yesterday.length) {
    const y = sumFood(yesterday)
    const pGap = LIMITS.protein - y.protein
    lines.push(`昨天：${fmt(y.kcal)} kcal · 蛋白 ${fmt(y.protein)}g${pGap > 0 ? `（差 ${fmt(pGap)}g）` : ' ✓'} · 脂肪 ${fmt(y.fat)}g`)
  }

  if (!today.length) {
    if (slot === 'morning') lines.push('今天照基线吃：早餐 3 个蛋 + 1 袋 CP + 绿叶菜 + 半个牛油果（约 500 kcal · 蛋白 42g）')
    else if (slot === 'night') lines.push('今天还没有饮食记录。吃了的话回我一句补上；22:00 前吃完，之后不再吃。')
    else lines.push('今天还没有饮食记录。照基线：CP 3 袋 + 西兰花 150g + 橄榄油 15g（蛋白约 60g）。吃完回我一句。')
  } else {
    lines.push(`今天已吃：${fmt(t.kcal)} kcal · 蛋白 ${fmt(t.protein)}g · 脂肪 ${fmt(t.fat)}g`)
    if (t.fat < LIMITS.fatMin) lines.push(`🥑 脂肪还差 ${fmt(LIMITS.fatMin - t.fat)}g（目标 ${LIMITS.fatMin}–${LIMITS.fat}g）：这顿带上橄榄油 / 牛油果 / 肥鱼，别吃成高蛋白低热量`)
    const s = suggest(t, { cpEaten: cpBagsEaten(today) })
    if (s.status === 'done') lines.push(slot === 'night' ? '✅ 今天都到位了，睡前别再加餐。' : '✅ 蛋白、热量都到了，今天不用再吃。')
    else if (s.status === 'over') lines.push(`⚠ ${s.over.join('、')}超了，今天别再加。`)
    else {
      const need = s.status === 'protein'
        ? `还差：蛋白 ${fmt(s.need.p)}g${s.need.kcal > 0 ? ` · 热量离 ${fmt(LIMITS.kcalFloor)} 差 ${fmt(s.need.kcal)}` : ''}`
        : `蛋白够了，热量离 ${fmt(LIMITS.kcalFloor)} 还差 ${fmt(s.need.kcal)}`
      lines.push(need)
      if (s.over.length) lines.push(`⚠ ${s.over.join('、')}已经超了，别再往上加`)
      if (slot === 'night') lines.push(`👉 22:00 前补一样：${optionLine(s.options[0], 0).slice(3)}`)
      else lines.push('👉 二选一：', ...s.options.slice(0, 2).map(optionLine))
    }
  }

  lines.push(`💊 ${supplementsFor(slot, weekday, ateFish(today)).join('、')}`)
  if (slot === 'morning') lines.push('💧 先喝 500ml 水；今天目标 3–3.5L')
  if (slot === 'dinner') lines.push('⏰ 21:30 前吃完')
  if (slot === 'night') lines.push('💧 睡前 2 小时少喝水；1 点前睡')
  lines.push('吃了什么回我一句就行，我来记。')
  return lines.join('\n')
}
