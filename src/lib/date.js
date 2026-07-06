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
