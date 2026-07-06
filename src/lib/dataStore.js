import { supabase, hasSupabase } from './supabase'

// ── 统一数据访问层 ──
// 正式模式：Supabase；演示模式：localStorage（键 pm_<table>）。
// 所有页面只通过 db.* 读写，切换模式零改动。

const LS_PREFIX = 'pm_'

function lsRead(table) {
  try {
    return JSON.parse(localStorage.getItem(LS_PREFIX + table) || '[]')
  } catch {
    return []
  }
}

function lsWrite(table, rows) {
  localStorage.setItem(LS_PREFIX + table, JSON.stringify(rows))
}

function matchFilters(row, filters) {
  if (!filters) return true
  return Object.entries(filters).every(([k, v]) => row[k] === v)
}

export const isDemo = !hasSupabase

export const db = {
  // opts: { orderBy, ascending, filters: {col: val}, limit }
  async list(table, opts = {}) {
    const { orderBy = 'created_at', ascending = false, filters, limit } = opts
    if (!hasSupabase) {
      let rows = lsRead(table).filter(r => matchFilters(r, filters))
      rows.sort((a, b) => {
        const av = a[orderBy] ?? ''
        const bv = b[orderBy] ?? ''
        if (av === bv) return 0
        return (av > bv ? 1 : -1) * (ascending ? 1 : -1)
      })
      if (limit) rows = rows.slice(0, limit)
      return rows
    }
    let q = supabase.from(table).select('*').order(orderBy, { ascending })
    if (filters) Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v) })
    if (limit) q = q.limit(limit)
    const { data, error } = await q
    if (error) throw error
    return data || []
  },

  async insert(table, row) {
    if (!hasSupabase) {
      const rows = lsRead(table)
      const newRow = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }
      rows.push(newRow)
      lsWrite(table, rows)
      return newRow
    }
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) throw error
    return data
  },

  async update(table, id, patch) {
    if (!hasSupabase) {
      const rows = lsRead(table)
      const idx = rows.findIndex(r => r.id === id)
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...patch }
        lsWrite(table, rows)
        return rows[idx]
      }
      return null
    }
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async remove(table, id) {
    if (!hasSupabase) {
      lsWrite(table, lsRead(table).filter(r => r.id !== id))
      return
    }
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },

  // 演示模式数据清空（Settings 用）
  clearDemoData() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k))
  },

  // 全量导出（备份）
  async exportAll(tables) {
    const out = {}
    for (const t of tables) {
      out[t] = await db.list(t, { orderBy: 'created_at', ascending: true })
    }
    return out
  },
}

// 附件上传：正式模式走 Supabase Storage；演示模式转 base64 存行内（仅小文件）
export async function uploadFile(file) {
  if (!hasSupabase) {
    if (file.size > 1.5 * 1024 * 1024) {
      throw new Error('演示模式仅支持 1.5MB 以内文件，配置 Supabase 后无限制')
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  const ext = file.name.split('.').pop()
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('attachments').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('attachments').getPublicUrl(path)
  return data.publicUrl
}
