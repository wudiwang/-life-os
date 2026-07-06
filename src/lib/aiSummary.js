// 汇总各模块数据为文本摘要，供 AI 分析用
import { db } from './dataStore'
import { METRIC_TYPES, GOAL_LEVELS, GOAL_STATUS, MOODS } from './constants'
import { todayStr, addDays } from './date'

const recent = (rows, dateKey, days = 30) => {
  const cutoff = addDays(todayStr(), -days)
  return rows.filter(r => (r[dateKey] || '').slice(0, 10) >= cutoff)
}

export const AI_MODULES = [
  { key: 'health', label: '❤️ 健康' },
  { key: 'habits', label: '🔁 习惯' },
  { key: 'goals', label: '🎯 目标' },
  { key: 'work', label: '💼 工作' },
  { key: 'journal', label: '📔 心情日记' },
  { key: 'overall', label: '🌐 综合分析' },
]

export async function buildSummary(moduleKey) {
  const parts = []

  if (moduleKey === 'health' || moduleKey === 'overall') {
    const metrics = await db.list('health_metrics', { orderBy: 'measured_at', ascending: false, limit: 100 })
    if (metrics.length) {
      const byType = {}
      metrics.forEach(m => {
        const label = METRIC_TYPES.find(t => t.key === m.metric_type)?.label || m.metric_name || m.metric_type
        if (!byType[label]) byType[label] = []
        if (byType[label].length < 10) {
          byType[label].push(`${(m.measured_at || '').slice(0, 10)}: ${m.value_num}${m.value2_num ? '/' + m.value2_num : ''}${m.unit || ''}`)
        }
      })
      parts.push('【健康指标（近期）】\n' + Object.entries(byType).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n'))
    }
    const reports = await db.list('health_reports', { limit: 3 })
    if (reports.length) {
      parts.push('【体检报告摘要】\n' + reports.map(r => `${r.report_date} ${r.title}: ${r.summary || '（无摘要）'}`).join('\n'))
    }
  }

  if (moduleKey === 'habits' || moduleKey === 'overall') {
    const habits = await db.list('habits', { filters: { active: true } }).catch(() => db.list('habits'))
    const logs = recent(await db.list('habit_logs', { orderBy: 'log_date', ascending: false, limit: 300 }), 'log_date', 30)
    if (habits.length) {
      parts.push('【习惯打卡（近30天）】\n' + habits.map(h => {
        const c = logs.filter(l => l.habit_id === h.id && l.done).length
        return `${h.name}: 打卡 ${c} 次（目标 ${h.target_per_week || 7} 次/周）`
      }).join('\n'))
    }
  }

  if (moduleKey === 'goals' || moduleKey === 'overall') {
    const goals = await db.list('goals')
    const ms = await db.list('goal_milestones')
    if (goals.length) {
      parts.push('【目标】\n' + goals.filter(g => g.status !== 'dropped').map(g => {
        const lv = GOAL_LEVELS.find(l => l.key === g.level)?.label
        const st = GOAL_STATUS.find(s => s.key === g.status)?.label
        const gms = ms.filter(m => m.goal_id === g.id)
        const passed = gms.filter(m => m.status === 'passed').length
        return `[${lv}/${st}] ${g.title}（截止${g.due_date || '未定'}，检查点 ${passed}/${gms.length} 达成）`
      }).join('\n'))
    }
  }

  if (moduleKey === 'work' || moduleKey === 'overall') {
    const todos = await db.list('work_todos')
    const open = todos.filter(t => t.status !== 'done')
    const logs = recent(await db.list('work_logs', { orderBy: 'log_date', ascending: false, limit: 30 }), 'log_date', 14)
    if (open.length || logs.length) {
      parts.push(`【工作】\n待办 ${open.length} 项未完成。\n近两周日志：\n` +
        logs.slice(0, 7).map(l => `${l.log_date}: ${(l.content || '').slice(0, 80)}${l.issues ? `（问题：${l.issues.slice(0, 40)}）` : ''}`).join('\n'))
    }
  }

  if (moduleKey === 'journal' || moduleKey === 'overall') {
    const entries = recent(await db.list('journal_entries', { orderBy: 'entry_date', ascending: false, limit: 60 }), 'entry_date', 30)
    if (entries.length) {
      const avg = (entries.filter(e => e.mood).reduce((s, e) => s + e.mood, 0) / (entries.filter(e => e.mood).length || 1)).toFixed(1)
      parts.push(`【心情日记（近30天）】\n共 ${entries.length} 篇，平均心情 ${avg}/5。\n最近几篇：\n` +
        entries.slice(0, 5).map(e => `${e.entry_date} ${MOODS.find(m => m.value === e.mood)?.label || ''}: ${(e.content || '').slice(0, 60)}`).join('\n'))
    }
  }

  return parts.join('\n\n') || '（暂无数据，请先在各模块录入一些记录）'
}
