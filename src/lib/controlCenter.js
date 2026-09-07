const priorities = { high: 0, mid: 1, low: 2 }

export function nextTodos(rows, today) {
  return rows.filter(row => row.status !== 'done').toSorted((a, b) => {
    const due = row => row.due_date && row.due_date <= today ? 0 : 1
    return due(a) - due(b)
      || (priorities[a.priority] ?? 1) - (priorities[b.priority] ?? 1)
      || (a.due_date || '9999').localeCompare(b.due_date || '9999')
      || (a.created_at || '').localeCompare(b.created_at || '')
      || String(a.id).localeCompare(String(b.id))
  })
}

export function activeProjects(rows) {
  return rows.filter(row => row.status === 'active').toSorted((a, b) =>
    (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title))
}

export function replaceDigestBlock(content, name, summary) {
  if (!name.trim() || /[\r\n]/.test(name)) throw new Error('项目名称无效')
  const marker = `—— ${name} · 自动同步 ——`
  const endMarker = `—— ${name} · 同步结束 ——`
  const original = String(content || '')
  const start = original.indexOf(marker)
  const block = `${marker}\n${summary.trim()}\n${endMarker}`
  if (start < 0) return [original.trimEnd(), block].filter(Boolean).join('\n\n')
  const end = original.indexOf(endMarker, start + marker.length)
  // Legacy blocks had no end marker; stop at the next project's block.
  const remainder = original.slice(start + marker.length)
  const next = remainder.search(/^—— .+ · 自动同步 ——$/m)
  const until = end >= 0 ? end + endMarker.length
    : next >= 0 ? start + marker.length + next : original.length
  return original.slice(0, start) + block + (until < original.length ? '\n\n' + original.slice(until).trimStart() : '')
}

export function displayDigest(content) {
  return String(content || '').replace(/^—— .+ · 同步结束 ——\n?/gm, '').trim()
}
