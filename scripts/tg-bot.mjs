// 「大仙」Telegram 机器人：人生 OS 的对话入口
// 链路：TG 长轮询收消息 → 本机 Claude Code（订阅）作为大脑 → scripts/db.mjs 读写 Supabase → 回复 TG
// 用法：npm run bot   （Ctrl+C 停止）
// .env 需要：TELEGRAM_BOT_TOKEN（BotFather 的 token）、TG_ALLOWED_CHAT_ID（你的 chat id，首次运行时会打印）
// 会话延续：每个 chat 的 Claude session id 存在 scripts/.tg-session.json；TG 里发 /new 可开启新会话。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildRefinePrompt, parseRefineResult } from './refine-prompt.mjs'

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
relation_people(name,rel_type:family/friend/love,birthday,closeness) + relation_logs(person_id,log_date,event,feeling) 情感 | ai_reviews(module,prompt_summary,content) AI分析历史 | life_stage(field:principle/stage/focus/advice,content) 人生阶段
okr_objectives(level:year/quarter,period,title,track,why,metric,metric_target,metric_current,status) 年度/季度目标 | weekly_actions(title,detail,track,objective_id,per_week,weekdays,active,sort_order) 每周行为契约 + weekly_action_logs(action_id,log_date) 打卡 | principle_logs(log_date,content,skipped) 核心原则每日落实 | daily_focus(log_date,track:work/trade/life,content,win) 每日三向

## 行为准则
1. 用户随口说的事，主动判断该进哪张表：如"今天心情不错，跑了5公里" → journal_entries 记一笔 + 若有跑步习惯则 habit_logs 打卡；拿不准就问一句。
2. 写库后简短确认写了什么（表+关键内容），别整段复述。
3. 日期用北京时间；"今天"就是当天日期。mood 需 1-5 整数。
4. 回复风格：口语化、简洁、像靠谱朋友，适合手机上读；不用 Markdown 标题，少用列表，绝不长篇大论。
5. 查询类问题先查库再答，别凭空编。用户网页端是 https://life-os-topaz-zeta.vercel.app，细节可让他去网页看。
6. 任务计划分配：用户口头描述当天/近期任务计划时，拆成一条条 work_todos 逐条建单（title 简洁动词开头，priority 按语气和 deadline 判断 high/mid/low，有明确日期填 due_date），建完汇总确认清单。
7. 经验与感悟归档（存 knowledge_notes，category 精确匹配）：
   - 项目管理/工作经验/同行借鉴 → "项目管理"；股票交易思考/复盘/规则 → "交易迭代"；生活/饮食感悟复盘 → "生活感悟"
   - 健康类知识 → "健康知识"；人际关系知识 → "人际关系"；文档模板/工具类 → "文档模板"；拿不准就问
   每个分类的"总纲"笔记是索引：归档重要笔记后，把总纲里的索引清单也更新一行。
8. 用户的核心原则存在 life_stage 表（field=principle，现为"思维的迭代"）。当他聊到与原则相关的觉醒/反思时，可提议更新它；他谈交易或技能提升时，适时用这条原则提醒他关注迭代而非轮回。
9. 用户发来文章链接：用 WebFetch 抓取 → 提炼成摘要笔记（他关心什么就提炼什么角度）存对应分类，source 填原链接。存的是理解，不是收藏夹。
10. 知识复利（重要）：
   - 回写：当你查库+综合思考后产出了有价值的结论（复盘、对比、建议被用户认可），主动存为笔记（source 标"大仙合成"），别让好答案随聊天蒸发。
   - 互链：归档新笔记前先 list 同分类已有标题，相关的在正文末尾加一行"相关：《某笔记标题》"。
   - 矛盾标注：发现新内容与旧笔记冲突时，在新笔记里明确写"与《旧笔记》观点冲突：…"并告知用户。
11. 用户发文件给你时（TG 文件暂不能直接入库）：请他到网页端第二大脑上传附件，或把关键内容发文字给你来归档。
12. 行为契约与打卡（重要）：
   - 他用自然语言说做完了某个固定动作（如"周报发了""刚躺下""项目过完了"），先 list weekly_actions 找到对应那条，再往 weekly_action_logs 插 (action_id, log_date=今天)。已存在就别重复插。
   - 他讲到今天把核心原则用在了哪件事上 → 写 principle_logs(log_date, content)。一天一条，已有就 update。
   - 纯数字打卡和"原则 xxx"由机器人本地快路处理，不会进到你这儿；你只管自然语言那部分。
   - 定新目标/新动作时提醒他：每日只考核动作做没做，别把结果指标（收入、体脂数字）拿来每天自评——裁判和运动员是同一个人，那样必然放水或弃疗。动作数量和执行率成反比，能压成一条就别写四条。
13. 他现在是远程项目经理，最大的压力源是"远程工作的价值不可见"。当他表达工作焦虑时，别只安慰——把话题引到"这周的可见交付物做了没有"（周报、项目过账），那才是这类焦虑的正面战场。`

function askClaude(chatId, userText) {
  const sid = sessions[chatId]
  const args = ['-p', '--output-format', 'json',
    '--model', 'opus',  // 大脑锁定最新 Opus（当前 4.8），思考档位走 CC 默认 xhigh
    '--allowedTools', '"Bash(node scripts/db.mjs:*)"', '"Read"', '"Grep"', '"Glob"', '"WebFetch"', '"WebSearch"']
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
    await reply(chatId, '👋 我是大仙，你的人生 OS 管家。随便跟我说：记一笔今天的心情、加个待办、查查最近体重、聊聊目标……都行。\n\n快捷指令：「打卡」看今日动作，回数字完成打卡；「原则 xxx」记原则落实。发 /new 可重开会话。')
    return
  }

  // 打卡走确定性快路：不调 claude，立刻回，别让几十秒的等待劝退打卡
  const quick = await quickCheckin(text)
  if (quick) {
    console.log(`⚡ 快捷打卡：${text.slice(0, 30)}`)
    await reply(chatId, quick)
    return
  }

  await tg('sendChatAction', { chat_id: chatId, action: 'typing' })
  console.log(`💬 ${text.slice(0, 80)}`)
  const { text: answer } = askClaude(chatId, text)
  console.log(`🤖 ${answer.slice(0, 80)}`)
  await reply(chatId, answer)
}

// ── 本机 AI worker：网页/手机把快记原文丢进 ai_jobs，这里取走跑 claude -p，结果写回 ──
// 走订阅额度，不花 API 钱；不需要内网穿透，手机在外网也能用。前提：本机开着且这个进程在跑。
const SB = env.VITE_SUPABASE_URL
const SB_KEY = env.VITE_SUPABASE_ANON_KEY
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }

async function sb(path, init = {}) {
  const resp = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init.headers || {}) } })
  const body = await resp.text()
  if (!resp.ok) throw new Error(`${resp.status} ${body.slice(0, 200)}`)
  return body ? JSON.parse(body) : null
}

// ── TG 里直接打卡：不过 claude，回一个数字就入库，零等待 ──────────────
// 每多一步跳转，执行率就掉一半。所以打卡必须便宜到「回一个字符」。
// 走 claude 要几十秒，那点延迟足以让人放弃打卡，所以这条路必须是确定性的。
const todayStr = () => new Date().toLocaleDateString('sv-SE')

// 编号 = active 动作按 sort_order 的序号，与早晚简报里的编号一致且不随消息变化
async function activeActions() {
  const rows = await sb('weekly_actions?select=*&active=is.true&order=sort_order.asc')
  return (rows || []).map((a, i) => ({ ...a, no: i + 1 }))
}

async function markPrinciple(body) {
  const day = todayStr()
  const skipped = /^(没有|没|没落实|无|跳过|算了)$/.test(body)
  const payload = { log_date: day, content: skipped ? '' : body, skipped }
  const existing = await sb(`principle_logs?select=id&log_date=eq.${day}`)
  if (existing?.length) {
    await sb(`principle_logs?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
    })
  } else {
    await sb('principle_logs', { method: 'POST', body: JSON.stringify(payload) })
  }
  return skipped
    ? '记下了：今天没落实。诚实记录比空着有价值——空白无法复盘。'
    : `✅ 原则落实已记：${body}`
}

async function markActions(nos, day = todayStr()) {
  const list = await activeActions()
  if (!list.length) return '还没有行为契约。去「人生 OKR」页设几条再来打卡。'
  const hit = [], bad = [], dup = []
  for (const n of nos) {
    const a = list.find(x => x.no === n)
    if (!a) { bad.push(n); continue }
    const existing = await sb(`weekly_action_logs?select=id&action_id=eq.${a.id}&log_date=eq.${day}`)
    if (existing?.length) { dup.push(a.title); continue }
    await sb('weekly_action_logs', {
      method: 'POST',
      body: JSON.stringify({ action_id: a.id, log_date: day }),
    })
    hit.push(a.title)
  }
  const isToday = day === todayStr()
  const out = []
  if (hit.length) out.push(`✅ ${isToday ? '打卡' : `补打 ${day}`}：${hit.join('、')}`)
  if (dup.length) out.push(`（${dup.join('、')} ${isToday ? '今天' : day} 已经打过了）`)
  if (bad.length) out.push(`没有编号 ${bad.join('、')}，回「打卡」看当前清单。`)

  // 顺手报本周进度，给一点进展感——焦虑的反面不是放松，是进展感
  const after = await sb('weekly_action_logs?select=action_id,log_date&order=log_date.desc&limit=400')
  const mon = new Date(day); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(d.getDate() + i)
    return d.toLocaleDateString('sv-SE')
  })
  const left = list.filter(a => {
    const n = week.filter(d => after.some(l => l.action_id === a.id && l.log_date === d)).length
    return n < (a.per_week || 1)
  })
  out.push(left.length ? `本周还差：${left.map(a => `${a.no}.${a.title}`).join('、')}` : '本周所有动作都达标了 🎉')
  return out.join('\n')
}

async function listActions() {
  const list = await activeActions()
  if (!list.length) return '还没有行为契约。去「人生 OKR」页设几条。'
  const logs = await sb('weekly_action_logs?select=action_id,log_date&order=log_date.desc&limit=400')
  const day = todayStr()
  const lines = list.map(a => {
    const done = logs.some(l => l.action_id === a.id && l.log_date === day)
    return `${done ? '✅' : '⬜'} ${a.no}. ${a.title}`
  })
  return `📋 今日动作（回数字打卡，如「1」或「1 3」）：\n${lines.join('\n')}\n\n原则落实回「原则 今天它落在哪件事上」。`
}

// ── 快记提炼结果回流 ────────────────────────────────────────────
// 提炼完不通知，结果就躺在 ai_jobs.result 里等人打开网页——而"不打开网页"
// 正是整套推送要解决的问题。所以提炼完直接推 TG，回「好」就入库。
const hhmm = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const dayOf = iso => new Date(iso).toLocaleDateString('sv-SE')

function renderRefine(job) {
  const r = job.result || {}
  const L = [`✨ 快记提炼好了（${dayOf(job.created_at)}）`]
  if (r.comment) L.push(`\n${r.comment}`)
  if (r.journal?.content) L.push(`\n📔 整理后的正文：\n${r.journal.content}`)
  if (r.knowledge?.length) {
    L.push(`\n🧠 要存的知识（${r.knowledge.length} 条）：`)
    r.knowledge.forEach(k => L.push(`· [${k.category || '未分类'}] ${k.title}`))
  }
  if (r.todos?.length) {
    L.push(`\n✅ 要建的待办（${r.todos.length} 条）：`)
    r.todos.forEach(t => L.push(`· ${t.title}${t.due_date ? `（${t.due_date}）` : ''}`))
  }
  if (r.insight) {
    L.push(r.insight.merge_into
      ? `\n💡 命中老启示，计数 +1（不新建）`
      : `\n💡 新启示：${r.insight.title}`)
  }
  L.push(`\n———\n回「好」全部入库 · 「只存日记」只要正文 · 「不用」丢弃`)
  return L.join('\n')
}

// 复刻网页 applyDraft 的写库逻辑。TG 没有勾选框，所以是全存或全不存。
async function applyRefine(job, journalOnly = false) {
  const r = job.result || {}
  const date = dayOf(job.created_at)
  const line = `[${hhmm()}] ${String(r.journal?.content || '').trim()}`

  const [entry] = await sb(`journal_entries?select=*&entry_date=eq.${date}`) || []
  const extra = {}
  if (r.journal?.mood && !entry?.mood) extra.mood = r.journal.mood
  if (r.journal?.gratitude && !entry?.gratitude) extra.gratitude = r.journal.gratitude
  if (entry) {
    await sb(`journal_entries?id=eq.${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: (entry.content ? entry.content + '\n' : '') + line, ...extra }),
    })
  } else {
    await sb('journal_entries', {
      method: 'POST',
      body: JSON.stringify({ entry_date: date, mood: null, gratitude: '', content: line, ...extra }),
    })
  }

  let nk = 0, nt = 0, insightMsg = ''
  if (!journalOnly) {
    for (const k of r.knowledge || []) {
      await sb('knowledge_notes', {
        method: 'POST',
        body: JSON.stringify({ title: k.title, category: k.category, tags: k.tags, content: k.content, source: '快记提炼' }),
      })
      nk++
    }
    for (const t of r.todos || []) {
      await sb('work_todos', {
        method: 'POST',
        body: JSON.stringify({ title: t.title, priority: t.priority, due_date: t.due_date || null, status: 'open' }),
      })
      nt++
    }

    const now = new Date().toISOString()
    const [thread] = r.thread_id ? (await sb(`journal_threads?select=*&id=eq.${r.thread_id}`) || []) : []
    // 启示：命中老的只加计数（这就是去重），确实是新的才建一条
    const [hit] = r.insight?.merge_into
      ? (await sb(`insights?select=*&id=eq.${r.insight.merge_into}`) || []) : []
    if (hit) {
      await sb(`insights?id=eq.${hit.id}`, {
        method: 'PATCH', body: JSON.stringify({ hits: (hit.hits || 1) + 1, updated_at: now }),
      })
      insightMsg = ` · 启示「${hit.title}」+1`
    } else if (r.insight?.title) {
      await sb('insights', {
        method: 'POST',
        body: JSON.stringify({
          thread_id: thread?.id || null, title: r.insight.title, detail: r.insight.detail,
          track: thread?.track || null, source_quote: String(job.input || '').slice(0, 120),
          source_date: date, hits: 1, active: true,
        }),
      })
      insightMsg = ' · 新启示 1 条'
    }
    if (thread) {
      await sb(`journal_threads?id=eq.${thread.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ mention_count: (thread.mention_count || 0) + 1, last_noted_at: now }),
      })
    }
  }

  await patchJob(job.id, { status: 'applied' })
  return `已存：日记 1 条${nk ? ` · 笔记 ${nk} 条` : ''}${nt ? ` · 待办 ${nt} 条` : ''}${insightMsg}`
}

const pendingRefines = () =>
  sb('ai_jobs?select=*&status=eq.done&kind=eq.refine_note&order=created_at.asc')

// 返回 null 表示不是打卡指令，交给 claude 正常处理
async function quickCheckin(text) {
  const t = text.trim()
  try {
    // 提炼结果确认。放在最前面：这几个词在待确认时就是确认，不该被 claude 兜走
    if (/^(好|好的|确认|存|ok|OK|可以|行)$/.test(t) || /^(只存日记|只要日记)$/.test(t) || /^(不用|不要|算了|忽略|丢弃)$/.test(t)) {
      const jobs = await pendingRefines()
      if (!jobs?.length) return null // 没有待确认的，交给 claude 当普通对话
      if (/^(不用|不要|算了|忽略|丢弃)$/.test(t)) {
        for (const j of jobs) await patchJob(j.id, { status: 'dropped' })
        return `丢掉了 ${jobs.length} 条提炼结果。原话还在库里，网页「看原话」找得到。`
      }
      const only = /^(只存日记|只要日记)$/.test(t)
      const out = []
      for (const j of jobs) out.push(await applyRefine(j, only))
      return out.join('\n')
    }

    const mp = t.match(/^(原则|落实)[\s:：]*(.+)$/s)
    if (mp) return await markPrinciple(mp[2].trim())

    if (t === '打卡' || t === '/today') return await listActions()

    // 补打昨天：「昨 3」「昨天 3」。睡眠这类动作要在躺下那刻打卡，
    // 但那时候人正要放下手机——为了打卡而摸手机，本身就在破坏这条动作的目的。
    const my = t.match(/^(昨天?)[\s]*([\d\s,，、+]+)$/)
    if (my) {
      const nos = [...new Set(my[2].split(/[\s,，、+]+/).filter(Boolean).map(Number))].filter(n => n > 0)
      if (nos.length) {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return await markActions(nos, d.toLocaleDateString('sv-SE'))
      }
    }

    if (t === '三向' || t === '/focus') {
      const { FOCUS_TRACKS } = await import('../src/lib/constants.js')
      return FOCUS_TRACKS.map(k =>
        `${k.icon} ${k.label}\n${k.prompts.map(p => `· ${p}`).join('\n')}`
      ).join('\n\n') + '\n\n想到什么直接说，我帮你记进对应方向。'
    }

    // 整条消息只有数字和分隔符才算打卡，避免误吞正常对话
    if (/^[\d\s,，、+]+$/.test(t) && /\d/.test(t)) {
      const nos = [...new Set(t.split(/[\s,，、+]+/).filter(Boolean).map(Number))].filter(n => n > 0)
      if (nos.length) return await markActions(nos)
    }
  } catch (e) {
    return `打卡失败：${e.message.slice(0, 120)}\n（v8_okr_commitments.sql 执行了吗？）`
  }
  return null
}

// 异步跑 claude（不用 spawnSync，避免卡住 TG 长轮询）
function claudeAsync(prompt, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const p = spawn('claude -p', { shell: true, cwd: root })
    let out = ''
    let err = ''
    const timer = setTimeout(() => { p.kill(); reject(new Error('claude 超时')) }, timeoutMs)
    p.stdout.on('data', d => { out += d })
    p.stderr.on('data', d => { err += d })
    p.on('error', e => { clearTimeout(timer); reject(e) })
    p.on('close', code => {
      clearTimeout(timer)
      if (code !== 0 || !out.trim()) reject(new Error(err.trim().slice(0, 300) || `exit ${code}`))
      else resolve(out)
    })
    p.stdin.end(prompt)
  })
}

const patchJob = (id, data) =>
  sb(`ai_jobs?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) })

// 原子占坑：带 status=eq.pending 过滤更新，只有把它从 pending 改成 running 的那个实例算抢到。
// 万一同时跑了多份 bot（或将来多机），不会重复调 claude、重复写结果。
async function claimJob(id) {
  const rows = await sb(`ai_jobs?id=eq.${id}&status=eq.pending`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'running', started_at: new Date().toISOString() }),
  })
  return Array.isArray(rows) && rows.length > 0
}

const healthPrompt = (data, ask) => `你是昊天的私人健康顾问，服务于他的「人生 OS」个人管理系统。
他最关心的是**体脂率**和**身体年龄**——不是体重数字本身。他现在体脂偏高、内脏脂肪等级偏高，目标是减脂增肌。

基于下面的体成分数据：
1. 先说结论：这段时间他到底在变好还是变差，哪几个指标是关键证据（引用具体数值和变化量）；
2. **饮食**：给到具体的每日热量区间、蛋白质克数、以及 2-3 条可执行的吃法调整（不要"少油少盐"这种废话）；
3. **睡眠**：结合基础代谢和减脂目标说该怎么睡，几点睡、睡多久，为什么；
4. **行动计划**：未来 4 周，每周做什么，怎么衡量做到了没有。写成能直接抄进待办的样子；
5. 如果数据不足以下判断，直接说缺什么数据、建议他去测什么。

要求：中文，简洁分段，说人话，直接给结论和动作，不要开场白和免责套话。
你不是医生——涉及指标异常，建议就医而非诊断。

【体成分数据】
${data}
${ask ? `\n【他的问题】${ask}` : ''}`

// 提炼前把主线和启示取出来当「记忆」，让 AI 认得出老想法的新说法。
// 表还没建（v7 未执行）时静默降级为无记忆，不阻断提炼。
async function loadMemory() {
  try {
    const [threads, insights] = await Promise.all([
      sb('journal_threads?select=id,title,summary&status=eq.active&order=sort_order.asc'),
      sb('insights?select=id,title,hits&active=is.true&order=hits.desc&limit=40'),
    ])
    return { threads: threads || [], insights: insights || [] }
  } catch (e) {
    console.log(`（无记忆提炼：${e.message.slice(0, 60)}）`)
    return null
  }
}

async function runJob(job) {
  const kind = job.kind || 'refine_note'
  if (!await claimJob(job.id)) return // 被别的实例抢先了，跳过
  console.log(`🧪 任务 ${job.id.slice(0, 8)} [${kind}]：${job.input.slice(0, 40).replace(/\n/g, ' ')}...`)
  try {
    if (kind === 'health_advice') {
      const content = (await claudeAsync(healthPrompt(job.input, job.context))).trim()
      // 健康建议直接进 ai_reviews，网页/手机的「健康 → 体成分」和「AI 分析」都能看到
      await sb('ai_reviews', {
        method: 'POST',
        body: JSON.stringify({ module: 'health', prompt_summary: job.context || '体成分分析（本机 Claude）', content }),
      })
      await patchJob(job.id, { status: 'done', error: null, finished_at: new Date().toISOString() })
      console.log(`💪 健康建议已生成（${content.length} 字）`)
      return
    }

    const memory = await loadMemory()
    const result = parseRefineResult(await claudeAsync(buildRefinePrompt(job.input, job.context, memory)))
    await patchJob(job.id, { status: 'done', result, error: null, finished_at: new Date().toISOString() })
    const dedup = result.insight?.merge_into
      ? ' / 命中老启示，合并计数'
      : result.insight ? ' / 新启示 1 条' : ''
    console.log(`✨ 提炼完成：${result.comment || '(无说明)'}（知识 ${result.knowledge.length} 条 / 待办 ${result.todos.length} 条${dedup}）`)
  } catch (e) {
    await patchJob(job.id, { status: 'error', error: String(e.message).slice(0, 500), finished_at: new Date().toISOString() })
    console.error(`❌ 任务失败 ${job.id.slice(0, 8)}：`, e.message)
  }
}

// 提炼好但还没通知过的，推给用户等一句「好」。
// notified_at 防止 bot 每次重启就把老结果重推一遍。
async function notifyRefines() {
  if (!ALLOWED) return
  const jobs = await sb('ai_jobs?select=*&status=eq.done&kind=eq.refine_note&notified_at=is.null&order=created_at.asc&limit=3')
  for (const job of jobs || []) {
    await reply(ALLOWED, renderRefine(job))
    await patchJob(job.id, { notified_at: new Date().toISOString() })
    console.log(`📨 提炼结果已推送 ${job.id.slice(0, 8)}`)
  }
}

async function workerLoop() {
  if (!SB || !SB_KEY) {
    console.log('⚠️ .env 缺 Supabase 密钥，AI 提炼 worker 未启动')
    return
  }
  console.log('⚙️ AI 提炼 worker 已启动（轮询 ai_jobs，走本机 Claude 订阅）')
  let quiet = 0 // 建表前会一直报错，降噪：连续失败时拉长间隔、少刷屏
  for (;;) {
    let wait = 3000
    try {
      const jobs = await sb('ai_jobs?select=*&status=eq.pending&order=created_at.asc&limit=1')
      quiet = 0
      if (jobs?.length) {
        await runJob(jobs[0])
        continue
      }
      await notifyRefines()
    } catch (e) {
      if (quiet++ % 20 === 0) console.error('worker 轮询出错（是否还没执行 supabase/v4_ai_jobs.sql？）：', e.message)
      wait = 15000
    }
    await new Promise(r => setTimeout(r, wait))
  }
}

// ── 主循环：长轮询 ──
// 本机到 TG 的网络偶发抖动，启动调用带重试
async function tgRetry(method, params, tries = 8) {
  for (let i = 1; ; i++) {
    try {
      return await tg(method, params)
    } catch (e) {
      if (i >= tries) throw e
      console.log(`${method} 失败（${e.message}），${i * 5} 秒后重试 ${i}/${tries}...`)
      await new Promise(r => setTimeout(r, i * 5000))
    }
  }
}

console.log('🔌 清除旧 webhook（如有）...')
await tgRetry('deleteWebhook', {})
const me = await tgRetry('getMe', {})
if (!me.ok) {
  console.error('token 无效：', JSON.stringify(me))
  process.exit(1)
}
console.log(`✅ @${me.result.username} 已上线，等待消息中（Ctrl+C 停止）`)

// 与 TG 长轮询并行跑，不 await
workerLoop()

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
