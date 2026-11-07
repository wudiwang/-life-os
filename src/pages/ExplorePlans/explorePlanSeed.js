import { db, isDemo } from '../../lib/dataStore'
import { BANGKOK_ITEMS, BANGKOK_PLAN } from './explorePlanData'

// 跟 clearDemoData 一样走 pm_ 前缀，清空演示数据后会重新种入。
const SEED_FLAG = 'pm_explore_plan_seed_v1'

let inflight = null

// 正式库靠 v18 SQL 种子。这里只补演示模式（localStorage），并且只在一张计划都没有时写一次。
export function ensureDemoExplorePlans() {
  if (!isDemo) return Promise.resolve(false)
  if (localStorage.getItem(SEED_FLAG)) return Promise.resolve(false)
  if (!inflight) inflight = writeSeed().finally(() => { inflight = null })
  return inflight
}

async function writeSeed() {
  const existing = await db.list('explore_plans', { orderBy: 'sort_order', ascending: true })
  if (existing.length > 0) {
    localStorage.setItem(SEED_FLAG, '1')
    return false
  }
  const plan = await db.insert('explore_plans', { ...BANGKOK_PLAN })
  for (const item of BANGKOK_ITEMS) {
    await db.insert('explore_plan_items', {
      plan_id: plan.id,
      category: item.category,
      title: item.title,
      note: item.note,
      image_url: item.image_url,
      emoji: item.emoji,
      sort_order: item.sort_order,
      seed_key: item.seed_key,
      done: false,
      done_on: null,
      reflection: null,
      rating: null,
      photos: [],
    })
  }
  localStorage.setItem(SEED_FLAG, '1')
  return true
}
