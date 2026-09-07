// 跨项目每日进度同步：让本机 Codex/Claude 项目大脑把当天进展写进人生 OS，
// 不用用户再口述一遍（会漏、也啰嗦）。
//
// 链路：本机计划任务（每晚）→ 在目标项目目录里跑 Codex Max（Claude 可选兜底）
//      → 脚本先采集 git log / 改动量 / 工作区状态，纯文本大脑产出结构化 JSON
//      → 本脚本校验后写入 daily_focus（每日三向的对应格子）+ journal_threads.next_action
//      → TG 推一条摘要给用户
//
// 用法：
//   node scripts/sync-project-progress.mjs              今天，全部项目
//   node scripts/sync-project-progress.mjs --dry        只打印不写库
//   node scripts/sync-project-progress.mjs --date 2026-08-03   补跑指定日期
//   node scripts/sync-project-progress.mjs --only trade
//
// 加新项目：往下面 PROJECTS 里加一条即可。

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { runLocalBrain } from './local-brain.mjs'
import { loadProjects } from './project-sync-config.mjs'
import { replaceDigestBlock } from '../src/lib/controlCenter.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── 要同步的项目 ────────────────────────────────────────────
const PROJECTS = loadProjects(root)

// ── 参数 ────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = f => argv.includes(f)
const val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null }
const DRY = has('--dry')
const ONLY = val('--only')
const DATE = val('--date') || new Date().toLocaleDateString('sv-SE')

// ── 环境 ────────────────────────────────────────────────
const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const sbHeaders = {
  apikey: KEY, Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json', Prefer: 'return=representation',
}

async function sb(path, init = {}) {
  const resp = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init.headers || {}) } })
  const body = await resp.text()
  if (!resp.ok) throw new Error(`${resp.status} ${body.slice(0, 200)}`)
  return body ? JSON.parse(body) : null
}

const log = (...a) => console.log(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}]`, ...a)

// ── 采集项目当天的客观事实，先算好再交给 AI，省得它自己摸索浪费轮次 ──
function gitFacts(cwd, date) {
  const git = args => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 }).trim()
    } catch {
      return ''
    }
  }
  const since = `${date} 00:00:00`
  const until = `${date} 23:59:59`
  return {
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    commits: git(['log', `--since=${since}`, `--until=${until}`, '--date=short', '--pretty=%h %ad %s']),
    stat: git(['log', `--since=${since}`, `--until=${until}`, '--shortstat', '--pretty=']),
    dirty: git(['status', '--short']),
    diffstat: git(['diff', '--stat']),
  }
}

function buildPrompt(proj, date, facts, insightTitles) {
  return `你现在在「${proj.name}」这个项目目录里（${proj.path}）。用户每天在这里用本机 Agent 做迭代和探索。

你的任务：总结 **${date}** 这一天这个项目的真实进展，产出一份能直接进他「人生 OS」的日报。

## 已经替你查好的客观事实

【当前分支】${facts.branch || '(未知)'}
【当天提交】
${facts.commits || '（当天没有提交）'}
【当天改动量】
${facts.stat || '（无）'}
【尚未提交的改动】
${facts.dirty || '（工作区干净）'}
${facts.diffstat ? `\n【未提交 diff 概览】\n${facts.diffstat}` : ''}

## 分析边界

只根据上面已经采集的客观事实判断，不调用工具、不自行浏览仓库。提交信息不足以支持的方法论结论就不写，绝不从文件名猜测成果。
重点不是复述改了哪些代码，而是从提交说明和改动范围中提炼这一天明确验证、完成或推进了什么。

## 判定规则（重要）

- 当天完全没有提交、也没有未提交改动 → active 填 false，其余留空。宁可不写，也不要为了交差编进展。
- 只有琐碎改动（改错别字、调格式、纯配置）→ 也算 active:false。
- 不要复述代码 diff，用户要的是**认知上的推进**。

## 已有的启示（判重用，不要重复产出同样的规律）
${insightTitles.length ? insightTitles.map(t => `- ${t}`).join('\n') : '（暂无）'}

## 输出格式（严格遵守）

只输出一个 JSON 对象，不要解释文字，不要 markdown 围栏：
{
  "active": true 或 false,
  "summary": "今日进展，150字内。具体到做了什么、验证了什么、结论是什么。第三人称陈述，不要'我们'。",
  "win": "今天最值得记的一个成果，30字内",
  "next_action": "明天该接着做的下一步，30字内，具体到能直接动手",
  "insight": { "title": "25字内的可复用规律", "detail": "为什么成立、以后怎么用，150字内" } 或 null,
  "highlights": ["要点，20字内", "最多3条"]
}

insight 只在**这一天确实沉淀出可复用的方法论**时才给，否则填 null。全部中文。`
}

async function brainAsync(prompt, timeoutMs = 300000) {
  const result = await runLocalBrain({
    mode: 'text',
    prompt,
    timeout: Math.ceil(timeoutMs / 1000),
    model: 'opus',
  }, { timeoutMs: timeoutMs + 10000 })
  log(`本机大脑：${result.provider}`)
  return result.text
}

function parseDigest(stdout) {
  let body = String(stdout || '').trim()
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) body = fenced[1].trim()
  else {
    const s = body.indexOf('{')
    const e = body.lastIndexOf('}')
    if (s === -1 || e <= s) throw new Error('输出里找不到 JSON')
    body = body.slice(s, e + 1)
  }
  const d = JSON.parse(body)
  const str = (v, n) => String(v || '').trim().slice(0, n)
  const ins = d.insight && typeof d.insight === 'object' && d.insight.title
    ? { title: str(d.insight.title, 60), detail: str(d.insight.detail, 400) }
    : null
  return {
    active: d.active === true,
    summary: str(d.summary, 600),
    win: str(d.win, 100),
    next_action: str(d.next_action, 120),
    insight: ins,
    highlights: (Array.isArray(d.highlights) ? d.highlights : []).slice(0, 3).map(h => str(h, 60)).filter(Boolean),
  }
}

async function tgNotify(text) {
  const token = env.TELEGRAM_BOT_TOKEN
  const chat = env.TG_ALLOWED_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3800) }),
    })
  } catch (e) {
    log('TG 推送失败：', e.message)
  }
}

// ── 写库：只覆盖自己那一段，绝不动用户手写的内容 ──
async function writeBack(proj, date, d) {
  const block = [d.summary, ...(d.highlights.length ? [d.highlights.map(h => `· ${h}`).join('\n')] : []),
    d.next_action ? `下一步建议：${d.next_action}` : ''].filter(Boolean).join('\n')

  const [existing] = await sb(`daily_focus?log_date=eq.${date}&track=eq.${proj.track}`)
  const content = replaceDigestBlock(existing?.content, proj.name, block)
  if (content === existing?.content) return { unchanged: true, note: '' }
  // 成果栏用户自己写过就不动，只在空着时替他填上
  const win = String(existing?.win || '').trim() || d.win

  if (existing) {
    await sb(`daily_focus?id=eq.${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content, win, updated_at: new Date().toISOString() }),
    })
  } else {
    await sb('daily_focus', {
      method: 'POST',
      body: JSON.stringify({ log_date: date, track: proj.track, content, win }),
    })
  }

  // 主线：只更新「下一步」和提及计数，summary（当前结论）留给用户自己维护
  let threadNote = ''
  try {
    const threads = await sb(`journal_threads?track=eq.${proj.track}&status=eq.active&order=sort_order.asc`)
    const matches = (threads || []).filter(t => proj.threadId ? t.id === proj.threadId
      : proj.threadMatch && t.title.includes(proj.threadMatch))
    const th = matches.length === 1 ? matches[0] : null
    if (th && d.next_action && !String(th.next_action || '').trim()) {
      await sb(`journal_threads?id=eq.${th.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          next_action: d.next_action,
          last_noted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      })
      threadNote = `\n🧵 主线「${th.title}」下一步已更新`
    }
  } catch (e) {
    log('主线更新跳过（v7 未执行？）：', e.message)
  }

  let insightNote = ''
  if (d.insight) {
    try {
      const query = new URLSearchParams({ select: 'id', source_date: `eq.${date}`, source_quote: `eq.${proj.name} ${date} 自动同步`, title: `eq.${d.insight.title}` })
      const duplicates = await sb(`insights?${query}`)
      if (!duplicates.length) await sb('insights', {
        method: 'POST',
        body: JSON.stringify({
          title: d.insight.title, detail: d.insight.detail, track: proj.track,
          source_quote: `${proj.name} ${date} 自动同步`, source_date: date, hits: 1, active: true,
        }),
      })
      if (!duplicates.length) insightNote = `\n💡 新启示：${d.insight.title}`
    } catch (e) {
      log('启示写入跳过：', e.message)
    }
  }
  return { unchanged: false, note: threadNote + insightNote }
}

async function syncOne(proj) {
  log(`▶ ${proj.name}（${DATE}）`)
  const facts = gitFacts(proj.path, DATE)
  if (!facts.branch) {
    log(`  ✗ ${proj.path} 不是 git 仓库或路径不可达，跳过`)
    return
  }
  if (!facts.commits && !facts.dirty) {
    log('  · 当天无提交、工作区干净 → 跳过，不打扰')
    return
  }

  let insightTitles = []
  try {
    const rows = await sb('insights?select=title&active=is.true&order=hits.desc&limit=30')
    insightTitles = (rows || []).map(r => r.title)
  } catch { /* v7 未执行，无记忆也能跑 */ }

  const d = parseDigest(await brainAsync(buildPrompt(proj, DATE, facts, insightTitles)))

  if (!d.active) {
    log('  · AI 判定当天无实质进展 → 不写入')
    return
  }
  log(`  摘要：${d.summary.slice(0, 60)}...`)
  log(`  成果：${d.win}`)
  log(`  下一步：${d.next_action}`)

  if (DRY) {
    log('  （--dry，未写库）')
    console.log(JSON.stringify(d, null, 2))
    return
  }

  const extra = await writeBack(proj, DATE, d)
  log('  ✓ 已写入 daily_focus')
  if (!extra.unchanged) await tgNotify(`📊 ${proj.name} · ${DATE} 进展已同步\n\n${d.summary}\n\n✨ ${d.win}\n▶ 下一步建议：${d.next_action}${extra.note}`)
}

const targets = PROJECTS.filter(p => !ONLY || p.key === ONLY)
if (!targets.length) {
  console.error(`没有匹配的项目：${ONLY}`)
  process.exit(1)
}
for (const proj of targets) {
  try {
    await syncOne(proj)
  } catch (e) {
    log(`  ✗ ${proj.name} 同步失败：${e.message}`)
    await tgNotify(`⚠️ ${proj.name} 进度同步失败：${e.message.slice(0, 200)}`)
  }
}
log('完成')
