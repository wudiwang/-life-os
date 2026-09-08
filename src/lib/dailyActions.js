export function bangkokDay(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
}

export function actionsForDay(todos, entries, day, historical = false) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  return todos.filter(todo => {
    if (todo.created_at && bangkokDay(new Date(todo.created_at)) > day) return false
    if (entries.some(e => e.todo_id === todo.id && e.log_date === day)) return true
    if (todo.repeat_weekdays?.length) return (!todo.due_date || todo.due_date <= day) && todo.repeat_weekdays.includes(weekday)
    return (!todo.due_date || todo.due_date <= day) && (todo.status !== 'done' || (todo.done_at && bangkokDay(new Date(todo.done_at)) === day) || entries.some(e => e.todo_id === todo.id && e.log_date === day))
  }).map(todo => {
    const entry = entries.find(e => e.todo_id === todo.id && e.log_date === day)
    const dayState = historical && entry ? entry.state : todo.repeat_weekdays?.length
      ? entry?.state || 'open'
      : todo.status === 'done' ? 'done' : entry?.state === 'skipped' ? 'skipped' : 'open'
    return { ...todo, entry, dayState }
  }).sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, mid: 1, low: 2 }[b.priority] ?? 1) || (a.created_at || '').localeCompare(b.created_at || ''))
}

export const MAIN_LINES = [
  { key: 'work', title: 'PM 工作', color: '#2563eb', boundary: '完成职责内交付；外部依赖不算个人失败。', detail: '已有职责记录：需求承接、重点项目进度跟进与反馈。当天具体交付和验收条件由你确定；协作方责任、领导最新期望尚需核实，不自动替你认领。交付物可查看、阻塞与下一步清楚后即可收尾，不无限扩大范围。' },
  { key: 'trade', title: '交易研究', color: '#15803d', boundary: '一个问题，建议 10 分钟；到点可以停。', detail: '本期只推进一个图形疑问：保留图的来源、待验证问题与下一步。单张图不能证明策略有效，不要求当天写策略、交易或获得收益。完成这一步就允许休息，不自动加码。' },
  { key: 'life', title: '长期能力与习惯', color: '#a16207', boundary: '英语 20 分钟、泰语 10 分钟；生活与休息留白。', detail: '学习每周6天、1天休息或轻复盘，忙碌日各5分钟保底，不补积压课。阶段目标依据基线调整，不保证考试结果。生活体验、社交与休息不必每件事都变成任务。' },
]
