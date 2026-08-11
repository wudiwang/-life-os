// 时间工具：统一北京时间（UTC+8）展示

export function todayStr() {
  return new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD 本地时区
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

// 最近 n 天日期数组（含今天，升序）
export function lastNDays(n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) out.push(addDays(todayStr(), -i))
  return out
}

// 周一为一周第一天：1=周一 … 7=周日
export function weekdayIndex(dateStr = todayStr()) {
  return ((new Date(dateStr).getDay() + 6) % 7) + 1
}

// 本周的 7 个日期（周一 → 周日，升序）
export function thisWeekDays(dateStr = todayStr()) {
  const mon = addDays(dateStr, -(weekdayIndex(dateStr) - 1))
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

export function currentYear(dateStr = todayStr()) {
  return String(new Date(dateStr).getFullYear())
}

// '2026Q3'
export function currentQuarter(dateStr = todayStr()) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`
}
