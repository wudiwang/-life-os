// 「大仙」Telegram 机器人：人生 OS 的对话入口
// 链路：TG 长轮询收消息 → 本机 Claude Code（订阅）作为大脑 → scripts/db.mjs 读写 Supabase → 回复 TG
// 用法：npm run bot   （Ctrl+C 停止）
// .env 需要：TELEGRAM_BOT_TOKEN（BotFather 的 token）、TG_ALLOWED_CHAT_ID（你的 chat id，首次运行时会打印）
// 会话延续：每个 chat 的 Claude session id 存在 scripts/.tg-session.json；TG 里发 /new 可开启新会话。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SESSION_FILE = join(root, 'scripts', '.tg-session.json')

const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const TOKEN = env.TELEGRAM_BOT_TOKEN
const ALLOWED = env.TG_ALLOWED_CHAT_ID
if (!TOKEN) {
  console.error('缺少 .env 中的 TELEGRAM_BOT_TOKEN（向 @BotFather 发 /mybots → API Token 获取）')
  process.exit(1)
}
const API = `https://api.telegram.org/bot${TOKEN}`

const sessions = existsSync(SESSION_FILE) ? JSON.parse(readFileSync(SESSION_FILE, 'utf8')) : {}
const saveSessions = () => writeFileSync(SESSION_FILE, JSON.stringify(sessions))

async function tg(method, params) {
  const resp = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return resp.json()
}

async function reply(chatId, text) {
  // TG 单条上限 4096，超长切块；纯文本发送避免 Markdown 解析报错
  for (let i = 0; i < text.length; i += 3800) {
    await tg('sendMessage', { chat_id: chatId, text: text.slice(i, i + 3800) })
  }
}

const SYSTEM = `你是"大仙"，用户的私人生活管家，运行在用户自己的电脑上，通过 Telegram 与用户对话。
你背后是"人生 OS"个人管理系统（Supabase 云端数据库），用户会通过聊天让你：记录生活、添加/查询/更新各模块数据、聊目标聊感受、要分析建议。

## 数据库操作（你的手）
用 Bash 运行：node scripts/db.mjs <list|insert|update|remove> <表> [参数]
- list:   node scripts/db.mjs list habits "&order=created_at.desc&limit=10"   （第三参是 PostgREST 查询串，可过滤排序）
- insert: node scripts/db.mjs insert journal_entries "{\\"entry_date\\":\\"2026-08-05\\",\\"mood\\":4,\\"content\\":\\"...\\"}"
- update: node scripts/db.mjs update work_todos <id> "{\\"status\\":\\"done\\"}"
- remove: node scripts/db.mjs remove work_todos <id>

## 表清单（字段详情可读 supabase/v1_init.sql）
journal_entries(entry_date,mood 1-5,content,gratitude) 每日一记 | health_metrics(metric_type,value_num,value2_num,unit,measured_at,note) 健康指标 | health_reports 体检报告
habits(name,icon,target_per_week,active) + habit_logs(habit_id,log_date,done) 习惯打卡 | goals(title,level:year/quarter/month/short,status:planning/active/done/dropped,due_date) + goal_milestones(goal_id,title,due_date,check_criteria,status,check_result) + goal_logs(goal_id,log_date,content) 目标
work_todos(title,priority:high/mid/low,due_date,status:open/done) + work_logs(log_date,content,output,issues) + work_profile(field,content) + work_contacts 工作
explore_records(title,category:food/travel/experience/insight/other,record_date,location,rating,content) 探索 | knowledge_notes(title,category,tags,content,source) 第二大脑
relation_people(name,rel_type:family/friend/love,birthday,closeness) + relation_logs(person_id,log_date,event,feeling) 情感 | ai_reviews(module,prompt_summary,content) AI分析历史 | life_stage(field:stage/focus/advice,content) 人生阶段

## 行为准则
1. 用户随口说的事，主动判断该进哪张表：如"今天心情不错，跑了5公里" → journal_entries 记一笔 + 若有跑步习惯则 habit_logs 打卡；拿不准就问一句。
2. 写库后简短确认写了什么（表+关键内容），别整段复述。
3. 日期用北京时间；"今天"就是当天日期。mood 需 1-5 整数。
4. 回复风格：口语化、简洁、像靠谱朋友，适合手机上读；不用 Markdown 标题，少用列表，绝不长篇大论。
5. 查询类问题先查库再答，别凭空编。用户网页端是 https://life-os-topaz-zeta.vercel.app，细节可让他去网页看。`

function askClaude(chatId, userText) {
  const sid = sessions[chatId]
  const args = ['-p', '--output-format', 'json',
    '--allowedTools', '"Bash(node scripts/db.mjs:*)"', '"Read"', '"Grep"', '"Glob"']
  if (sid) args.push('--resume', sid)
  const today = new Date().toLocaleDateString('sv-SE')
  const prompt = sid
    ? `（今天是 ${today}）${userText}`
    : `${SYSTEM}\n\n（今天是 ${today}）用户说：${userText}`
  const r = spawnSync(`claude ${args.join(' ')}`, {
    input: prompt, encoding: 'utf8', shell: true, cwd: root, timeout: 600000,
  })
  if (r.status !== 0 || !r.stdout?.trim()) {
    console.error('claude 调用失败：', (r.stderr || '').slice(0, 500))
    return { text: '（大脑开小差了，稍后再试，或看电脑控制台日志）' }
  }
  try {
    const out = JSON.parse(r.stdout)
    if (out.session_id) { sessions[chatId] = out.session_id; saveSessions() }
    return { text: out.result || '（空回复）' }
  } catch {
    return { text: r.stdout.trim().slice(0, 3800) }
  }
}

async function handleMessage(msg) {
  const chatId = String(msg.chat.id)
  const text = (msg.text || '').trim()
  if (!text) return

  if (!ALLOWED) {
    console.log(`⚠️ 收到来自 chat_id=${chatId}（${msg.from?.first_name || ''} @${msg.from?.username || ''}）的消息。`)
    console.log(`   请把 TG_ALLOWED_CHAT_ID=${chatId} 加入 .env 后重启机器人。`)
    await reply(chatId, `你的 chat id 是 ${chatId}，请把它配置到机器人 .env 的 TG_ALLOWED_CHAT_ID 后重启。`)
    return
  }
  if (chatId !== ALLOWED) {
    console.log(`🚫 拒绝陌生 chat_id=${chatId}`)
    return
  }

  if (text === '/new') {
    delete sessions[chatId]
    saveSessions()
    await reply(chatId, '🧹 新会话已开启，之前聊的上下文清空了。')
    return
  }
  if (text === '/start') {
    await reply(chatId, '👋 我是大仙，你的人生 OS 管家。随便跟我说：记一笔今天的心情、加个待办、查查最近体重、聊聊目标……都行。发 /new 可重开会话。')
    return
  }

  await tg('sendChatAction', { chat_id: chatId, action: 'typing' })
  console.log(`💬 ${text.slice(0, 80)}`)
  const { text: answer } = askClaude(chatId, text)
  console.log(`🤖 ${answer.slice(0, 80)}`)
  await reply(chatId, answer)
}

// ── 主循环：长轮询 ──
console.log('🔌 清除旧 webhook（如有）...')
await tg('deleteWebhook', {})
const me = await tg('getMe', {})
if (!me.ok) {
  console.error('token 无效：', JSON.stringify(me))
  process.exit(1)
}
console.log(`✅ @${me.result.username} 已上线，等待消息中（Ctrl+C 停止）`)

let offset = 0
for (;;) {
  try {
    const resp = await fetch(`${API}/getUpdates?timeout=50&offset=${offset}`, { signal: AbortSignal.timeout(60000) })
    const data = await resp.json()
    if (data.ok) {
      for (const upd of data.result) {
        offset = upd.update_id + 1
        if (upd.message) await handleMessage(upd.message).catch(e => console.error('处理消息出错：', e.message))
      }
    }
  } catch (e) {
    if (e.name !== 'TimeoutError') console.error('轮询出错（5秒后重试）：', e.message)
    await new Promise(r => setTimeout(r, 5000))
  }
}
