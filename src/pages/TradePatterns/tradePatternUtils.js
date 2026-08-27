export function excerpt(value, limit = 90) {
  const text = String(value || '')
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}…`
}

export function filterPatterns(patterns, { query = '', status = 'all' } = {}) {
  const needle = query.trim().toLocaleLowerCase()
  return patterns.filter(pattern => {
    if (status !== 'all' && pattern.status !== status) return false
    if (!needle) return true
    const haystack = [
      pattern.title, pattern.original_quote, pattern.observations,
      pattern.hypotheses, pattern.pending_questions,
      ...(Array.isArray(pattern.tags) ? pattern.tags : []),
    ].filter(Boolean).join('\n').toLocaleLowerCase()
    return haystack.includes(needle)
  })
}

export function normalizeDraft(form, uuid, date) {
  return {
    source_key: `web-${uuid}`,
    source_project: 'trade',
    title: String(form.title || '').trim(),
    pattern_type: 'case',
    status: 'idea',
    origin_date: date,
    direction: form.direction || 'unknown',
    symbol: String(form.symbol || '').trim() || null,
    timeframe: String(form.timeframe || '').trim() || null,
    tags: String(form.tags || '').split(/[,，]/).map(value => value.trim()).filter(Boolean),
    original_quote: String(form.original_quote || ''),
    observations: '',
    hypotheses: '',
    pending_questions: '',
    image_url: form.image_url || null,
    source_path: null,
    source_hash: null,
    sync_state: 'pending_writeback',
    sync_error: null,
    created_via: 'life_os',
  }
}

export function syncLabel(state) {
  return {
    synced: '已归档到交易项目',
    pending_writeback: '等待本地写回',
    sync_error: '同步失败',
  }[state] || '状态未知'
}
