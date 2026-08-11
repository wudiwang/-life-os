// 每日 TG 简报：把人生 OS 推到你已有的高频入口，而不是等你想起来打开网页。
//
// 为什么这么做：网页需要你「主动想起来」，而这类系统的价值恰恰依赖于「不用想起来」。
// 用自律去解决"打开率低"这个自律问题是死循环，所以改成推送找人。
//
// 用法：
//   node scripts/daily-brief.mjs --morning     早上：今天该做的动作 + 原则
//   node scripts/daily-brief.mjs --evening     晚上：收工三问
//   node scripts/daily-brief.mjs --morning --dry   只打印不推送
//
// 计划任务安装见 scripts/install-daily-brief.ps1

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const argv = process.argv.slice(2)
const has = f => argv.includes(f)
const DRY = has('--dry')
const MODE = has('--evening') ? 'evening' : 'morning'

const SB = env.VITE_SUPABASE_URL
const SB_KEY = env.VITE_SUPABASE_ANON_KEY
if (!SB || !SB_KEY) {
  console.error('缺少 .env 中的 Supabase 配置')
  process.exit(1)
}

async function sb(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 160)}`)
  return t ? JSON.parse(t) : null
}

// 表可能还没建（v8 未执行）：静默返回空，简报照发，不因为半个功能没上就整条不推
const soft = async path => { try { return (await sb(path)) || [] } catch { return [] } }

const today = new Date().toLocaleDateString('sv-SE')
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x.toLocaleDateString('sv-SE')
}
const weekdayIndex = d => ((new Date(d).getDay() + 6) % 7) + 1 // 1=周一
const thisWeek = (() => {
  const mon = addDays(today, -(weekdayIndex(today) - 1))
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
})()
const WD = ['一', '二', '三', '四', '五', '六', '日']

async function push(text) {
  const token = env.TELEGRAM_BOT_TOKEN
  const chat = env.TG_ALLOWED_CHAT_ID
  if (DRY || !token || !chat) {
    console.log(DRY ? '（--dry，不推送）\n' : '（未配置 TG，只打印）\n')
    console.log(text)
    return
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3800) }),
  })
  const j = await r.json()
  if (!j.ok) console.error('TG 推送失败：', JSON.stringify(j).slice(0, 200))
  else console.log(`✅ 已推送（${MODE}）`)
}

async function main() {
  const [stage, actions, logs, principleLogs, focus, todos] = await Promise.all([
    soft('life_stage?select=field,content&field=eq.principle'),
    soft('weekly_actions?select=*&active=is.true&order=sort_order.asc'),
    soft('weekly_action_logs?select=action_id,log_date&order=log_date.desc&limit=400'),
    soft(`principle_logs?select=*&log_date=in.(${today},${addDays(today, -1)})`),
    soft(`daily_focus?select=track,content,win&log_date=eq.${today}`),
    soft('work_todos?select=title,priority,due_date&status=eq.open&order=priority.asc&limit=20'),
  ])

  const principle = stage[0]?.content || ''
  const doneOn = (id, d) => logs.some(l => l.action_id === id && l.log_date === d)
  const weekDone = id => thisWeek.filter(d => doneOn(id, d)).length
  // 编号 = active 动作按 sort_order 的序号，稳定不随消息变化，方便在 TG 里回数字打卡
  const numbered = actions.map((a, i) => ({ ...a, no: i + 1 }))

  const dueToday = numbered.filter(a => {
    if (doneOn(a.id, today)) return false
    if (a.weekdays) return a.weekdays.split(',').map(s => s.trim()).includes(String(weekdayIndex(today)))
    return weekDone(a.id) < (a.per_week || 1)
  })
  const doneToday = numbered.filter(a => doneOn(a.id, today))
  const todayPrinciple = principleLogs.find(p => p.log_date === today)

  const L = []

  if (MODE === 'morning') {
    L.push(`☀️ ${today} 周${WD[weekdayIndex(today) - 1]}`)
    if (principle) L.push(`\n⚡ ${principle.split('\n')[0]}`)

    if (!actions.length) {
      L.push('\n（还没有行为契约。执行 supabase/v8_okr_commitments.sql 后去「人生 OKR」页设几条）')
    } else {
      L.push(`\n📋 今天要做的动作：`)
      if (dueToday.length === 0) {
        L.push('今天的都做完了 🎉')
      } else {
        dueToday.forEach(a => {
          const tag = a.weekdays ? '（固定今天）' : `（本周 ${weekDone(a.id)}/${a.per_week || 1}）`
          L.push(`${a.no}. ${a.title} ${tag}`)
        })
      }
      // 「今天不用做」有两种原因，别混为一谈：固定星期还没到 ≠ 本周已达标
      const rest = numbered.filter(a => !dueToday.includes(a) && !doneOn(a.id, today))
      const notYet = rest.filter(a => a.weekdays && weekDone(a.id) < (a.per_week || 1))
      const reached = rest.filter(a => !notYet.includes(a))
      if (notYet.length) {
        L.push(`\n今天不到日子：${notYet.map(a =>
          `${a.title}（周${a.weekdays.split(',').map(k => WD[Number(k.trim()) - 1]).join('')}）`).join('、')}`)
      }
      if (reached.length) {
        L.push(`\n本周已达标：${reached.map(a => a.title).join('、')}`)
      }
      L.push(`\n做完回数字打卡，如「1」或「1 3」`)
    }

    const highTodos = todos.filter(t => t.priority === 'high').slice(0, 3)
    if (highTodos.length) {
      L.push(`\n🔥 高优待办：\n${highTodos.map(t => `· ${t.title}`).join('\n')}`)
    }
    L.push(`\n———\n今天只要把上面这几条做掉，就算赢。别开新战线。`)
  } else {
    L.push(`🌙 ${today} 收工三问`)

    // 一问：动作
    if (actions.length) {
      if (dueToday.length === 0) {
        L.push(`\n① 动作 ✅ 今天该做的都打上了（${doneToday.length} 项）`)
      } else {
        L.push(`\n① 今天还差：`)
        dueToday.forEach(a => L.push(`${a.no}. ${a.title}`))
        L.push(`做了就回数字，如「${dueToday[0].no}」；没做就没做，明天补。`)
      }
    }

    // 二问：原则落实 —— 这是每天必答的那一条
    if (todayPrinciple && !todayPrinciple.skipped) {
      L.push(`\n② 原则 ✅ 今天落在：${todayPrinciple.content}`)
    } else if (todayPrinciple?.skipped) {
      L.push(`\n② 原则：今天记为没落实。诚实记录也算数。`)
    } else {
      L.push(`\n② 今天这条原则落在哪件具体的事上？`)
      if (principle) L.push(`（${principle.split('\n')[0].slice(0, 40)}…）`)
      L.push(`回「原则 xxx」记下来；确实没有就回「原则 没有」。`)
    }

    // 三问：明天第一个动作
    const wrote = focus.filter(f => (f.content || '').trim() || (f.win || '').trim()).length
    L.push(`\n③ 明天上班第一件事做什么？想清楚再关电脑。`)
    if (wrote < 3) L.push(`（今日三向还差 ${3 - wrote} 个方向没写，回「三向」可以看提示）`)

    L.push(`\n———\n写完就关电脑。远程最耗人的是「永远没下班」。`)
  }

  await push(L.join('\n'))
}

main().catch(e => {
  console.error('简报失败：', e.message)
  process.exit(1)
})
