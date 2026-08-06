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
relation_people(name,rel_type:family/friend/love,birthday,closeness) + relation_logs(person_id,log_date,event,feeling) 情感 | ai_reviews(module,prompt_summary,content) AI分析历史 | life_stage(field:stage/focus/advice,content) 人生阶段

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
11. 用户发文件给你时（TG 文件暂不能直接入库）：请他到网页端第二大脑上传附件，或把关键内容发文字给你来归档。`

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
    await reply(chatId, '👋 我是大仙，你的人生 OS 管家。随便跟我说：记一笔今天的心情、加个待办、查查最近体重、聊聊目标……都行。发 /new 可重开会话。')
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

    const result = parseRefineResult(await claudeAsync(buildRefinePrompt(job.input, job.context)))
    await patchJob(job.id, { status: 'done', result, error: null, finished_at: new Date().toISOString() })
    console.log(`✨ 提炼完成：${result.comment || '(无说明)'}（知识 ${result.knowledge.length} 条 / 待办 ${result.todos.length} 条）`)
  } catch (e) {
    await patchJob(job.id, { status: 'error', error: String(e.message).slice(0, 500), finished_at: new Date().toISOString() })
    console.error(`❌ 任务失败 ${job.id.slice(0, 8)}：`, e.message)
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
