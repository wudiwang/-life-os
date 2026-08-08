import { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/dataStore'
import { useUIStore } from '../store/useUIStore'

// 通用表数据 hook：加载 + 增删改，自动刷新与错误提示
// opts 以 JSON 序列化做依赖，调用方可放心传字面量对象
// opts.optional：表可能还没建（新版 SQL 未执行）时静默降级为空，不弹错误提示
export function useTable(table, opts = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const showToast = useUIStore(s => s.showToast)
  const optsKey = JSON.stringify(opts)

  const reload = useCallback(async () => {
    const { optional, ...listOpts } = JSON.parse(optsKey)
    try {
      setRows(await db.list(table, listOpts))
    } catch (e) {
      console.error(`加载 ${table} 失败`, e)
      if (optional) setRows([])
      else showToast(`加载失败：${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [table, optsKey, showToast])

  useEffect(() => { reload() }, [reload])

  const add = useCallback(async row => {
    try {
      const r = await db.insert(table, row)
      await reload()
      return r
    } catch (e) {
      showToast(`保存失败：${e.message}`, 'error')
      throw e
    }
  }, [table, reload, showToast])

  const patch = useCallback(async (id, p) => {
    try {
      const r = await db.update(table, id, p)
      await reload()
      return r
    } catch (e) {
      showToast(`更新失败：${e.message}`, 'error')
      throw e
    }
  }, [table, reload, showToast])

  const del = useCallback(async id => {
    try {
      await db.remove(table, id)
      await reload()
    } catch (e) {
      showToast(`删除失败：${e.message}`, 'error')
      throw e
    }
  }, [table, reload, showToast])

  return { rows, loading, reload, add, patch, del }
}
