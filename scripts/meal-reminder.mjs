// 大仙的吃饭提醒：读今天（和昨天）的 shape_food_logs，按时段生成提醒，推送到 TG。
// 用法：
//   node scripts/meal-reminder.mjs --slot second        推送第二顿提醒（first / second / close，一天两顿）
//   node scripts/meal-reminder.mjs --dry                不推送，只打印（不写 --slot 就按当前曼谷时间猜）
// 定时在 .github/workflows/meal-reminder.yml（Mac 上也可用 scripts/install-launchd.sh，默认 11:45 / 18:15 / 19:45）。文案在 meal-reminder-core.mjs。
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildReminder, slotFor, SLOTS } from './meal-reminder-core.mjs'
import { addDays } from '../src/pages/Shape/shapeCalc.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env }
const envFile = join(root, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }

const now = new Date()
const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
const hhmm = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
const weekday = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1 // 1=周一
const slot = arg('--slot') || slotFor(hhmm)
if (!SLOTS[slot]) { console.error(`未知时段：${slot}（${Object.keys(SLOTS).join(' / ')}）`); process.exit(1) }

const SB = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY
if (!SB || !KEY) { console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1) }

async function foodRows() {
  const yesterday = addDays(today, -1)
  const r = await fetch(`${SB}/rest/v1/shape_food_logs?select=*&log_date=in.(${yesterday},${today})&order=created_at.asc`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!r.ok) throw new Error(`读饮食记录失败 ${r.status} ${(await r.text()).slice(0, 160)}`)
  const rows = await r.json()
  return { todayRows: rows.filter(x => x.log_date === today), yesterdayRows: rows.filter(x => x.log_date === yesterday) }
}

async function push(text) {
  const token = env.TELEGRAM_BOT_TOKEN, chat = env.TG_ALLOWED_CHAT_ID
  if (DRY || !token || !chat) {
    console.log(DRY ? '（--dry，不推送）\n' : '（未配置 TG，只打印）\n')
    console.log(text)
    return
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3800) }),
  })
  const j = await r.json()
  if (!j.ok) { console.error('TG 推送失败：', JSON.stringify(j).slice(0, 200)); process.exit(1) }
  console.log(`✅ 已推送吃饭提醒（${slot}，${today} ${hhmm}）`)
}

const { todayRows, yesterdayRows } = await foodRows()
await push(buildReminder({ slot, today: todayRows, yesterday: yesterdayRows, weekday, now: hhmm }))
