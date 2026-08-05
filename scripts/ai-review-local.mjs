// 本机 AI 分析：拉取 Supabase 数据 → 调本机 Claude Code（订阅，无 API 费用）→ 结果写回 ai_reviews 表
// 用法：npm run ai [模块] [问题]
//   模块：overall(默认) | health | habits | goals | work | journal
//   例：npm run ai health 我最近的体重趋势正常吗
// 结果会出现在网页「AI 分析」页的历史列表里（手机上也能看）。

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── 读 .env ──
const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const BASE = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!BASE || !KEY) {
  console.error('缺少 .env 中的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function list(table, query = '') {
  const resp = await fetch(`${BASE}/rest/v1/${table}?select=*${query}`, { headers })
  if (!resp.ok) throw new Error(`${table} 查询失败: ${resp.status} ${await resp.text()}`)
  return resp.json()
}

// ── 组装数据摘要（与前端 aiSummary.js 逻辑一致）──
const METRIC_LABELS = {
  weight: '体重', height: '身高', blood_pressure: '血压', heart_rate: '静息心率',
  blood_sugar: '空腹血糖', body_fat: '体脂率', sleep_hours: '睡眠时长',
}
const GOAL_LEVELS = { year: '年度', quarter: '季度', month: '月度', short: '短期' }
const GOAL_STATUS = { planning: '规划中', active: '进行中', done: '已完成', dropped: '已放弃' }
const MOOD_LABELS = { 1: '很差', 2: '不佳', 3: '一般', 4: '不错', 5: '很好' }

const daysAgo = n => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

async function buildSummary(moduleKey) {
  const parts = []
  const all = moduleKey === 'overall'

  if (all || moduleKey === 'health') {
    const metrics = await list('health_metrics', '&order=measured_at.desc&limit=100')
    if (metrics.length) {
      const byType = {}
      for (const m of metrics) {
        const label = METRIC_LABELS[m.metric_type] || m.metric_name || m.metric_type
        byType[label] ??= []
        if (byType[label].length < 10) {
          byType[label].push(`${(m.measured_at || '').slice(0, 10)}: ${m.value_num}${m.value2_num ? '/' + m.value2_num : ''}${m.unit || ''}`)
        }
      }
      parts.push('【健康指标（近期）】\n' + Object.entries(byType).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n'))
    }
    const reports = await list('health_reports', '&order=created_at.desc&limit=3')
    if (reports.length) {
      parts.push('【体检报告摘要】\n' + reports.map(r => `${r.report_date} ${r.title}: ${r.summary || '（无摘要）'}`).join('\n'))
    }
  }

  if (all || moduleKey === 'habits') {
    const habits = (await list('habits')).filter(h => h.active !== false)
    const logs = await list('habit_logs', `&log_date=gte.${daysAgo(30)}`)
    if (habits.length) {
      parts.push('【习惯打卡（近30天）】\n' + habits.map(h => {
        const c = logs.filter(l => l.habit_id === h.id && l.done).length
        return `${h.name}: 打卡 ${c} 次（目标 ${h.target_per_week || 7} 次/周）`
      }).join('\n'))
    }
  }

  if (all || moduleKey === 'goals') {
    const goals = await list('goals')
    const ms = await list('goal_milestones')
    const live = goals.filter(g => g.status !== 'dropped')
    if (live.length) {
      parts.push('【目标】\n' + live.map(g => {
        const gms = ms.filter(m => m.goal_id === g.id)
        const passed = gms.filter(m => m.status === 'passed').length
        return `[${GOAL_LEVELS[g.level] || g.level}/${GOAL_STATUS[g.status] || g.status}] ${g.title}（截止${g.due_date || '未定'}，检查点 ${passed}/${gms.length} 达成）`
      }).join('\n'))
    }
  }

  if (all || moduleKey === 'work') {
    const todos = await list('work_todos')
    const open = todos.filter(t => t.status !== 'done')
    const logs = await list('work_logs', `&log_date=gte.${daysAgo(14)}&order=log_date.desc`)
    if (open.length || logs.length) {
      parts.push(`【工作】\n待办 ${open.length} 项未完成。\n近两周日志：\n` +
        logs.slice(0, 7).map(l => `${l.log_date}: ${(l.content || '').slice(0, 80)}${l.issues ? `（问题：${l.issues.slice(0, 40)}）` : ''}`).join('\n'))
    }
  }

  if (all || moduleKey === 'journal') {
    const entries = await list('journal_entries', `&entry_date=gte.${daysAgo(30)}&order=entry_date.desc`)
    if (entries.length) {
      const moods = entries.filter(e => e.mood)
      const avg = (moods.reduce((s, e) => s + e.mood, 0) / (moods.length || 1)).toFixed(1)
      parts.push(`【心情日记（近30天）】\n共 ${entries.length} 篇，平均心情 ${avg}/5。\n最近几篇：\n` +
        entries.slice(0, 5).map(e => `${e.entry_date} ${MOOD_LABELS[e.mood] || ''}: ${(e.content || '').slice(0, 60)}`).join('\n'))
    }
  }

  return parts.join('\n\n')
}

// ── 主流程 ──
const MODULES = { overall: '🌐 综合分析', health: '❤️ 健康', habits: '🔁 习惯', goals: '🎯 目标', work: '💼 工作', journal: '📔 心情日记' }
const moduleKey = MODULES[process.argv[2]] ? process.argv[2] : 'overall'
const question = process.argv.slice(MODULES[process.argv[2]] ? 3 : 2).join(' ')

console.log(`📥 拉取数据（${MODULES[moduleKey]}）...`)
const dataSummary = await buildSummary(moduleKey)
if (!dataSummary) {
  console.error('暂无数据可分析，请先在系统里录入一些记录。')
  process.exit(1)
}

const prompt = `你是一位专业的个人生活管理顾问，服务于"人生 OS"个人管理系统。
基于下面用户的个人数据：
1. 给出客观、具体的评价（好的地方肯定，问题直说）；
2. 给出 2-4 条可落地的建议，具体到行动；
3. 如有风险（健康指标异常、目标严重滞后等）明确提醒（涉及健康建议就医而非诊断）；
4. 中文回答，简洁分段，不说空话套话。直接输出分析内容，不要开场白。

【分析模块】${MODULES[moduleKey]}
【我的数据】
${dataSummary}
${question ? `【我的问题】${question}` : ''}`

console.log('🤖 调用本机 Claude Code 分析中（约 1-2 分钟）...')
const r = spawnSync('claude -p', { input: prompt, encoding: 'utf8', shell: true, timeout: 300000 })
if (r.status !== 0 || !r.stdout?.trim()) {
  console.error('Claude Code 调用失败：', r.stderr || r.error?.message || `exit ${r.status}`)
  process.exit(1)
}
const content = r.stdout.trim()

console.log('📤 写回云端 ai_reviews...')
const resp = await fetch(`${BASE}/rest/v1/ai_reviews`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    module: moduleKey,
    prompt_summary: question || '常规分析（本机 Claude Code）',
    content,
  }),
})
if (!resp.ok) {
  console.error('写回失败：', resp.status, await resp.text())
  process.exit(1)
}

console.log('\n════════ 分析结果 ════════\n')
console.log(content)
console.log('\n✅ 已存入云端，网页/手机「AI 分析」页可查看历史。')
