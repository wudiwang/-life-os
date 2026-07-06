import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '../lib/dataStore'
import { useUIStore } from '../store/useUIStore'

// 通用表数据 hook：加载 + 增删改，自动刷新与错误提示
export function useTable(table, opts = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const showToast = useUIStore(s => s.showToast)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const reload = useCallback(async () => {
    try {
      setRows(await db.list(table, optsRef.current))
    } catch (e) {
      console.error(`加载 ${table} 失败`, e)
      showToast(`加载失败：${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [table, showToast])

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
