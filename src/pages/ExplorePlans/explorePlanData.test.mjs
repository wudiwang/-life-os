import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PLAN_ITEM_CATEGORIES } from '../../lib/constants.js'
import { beijingToday } from '../../lib/date.js'
import { BANGKOK_ITEMS, BANGKOK_PLAN } from './explorePlanData.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const sql = readFileSync(join(root, 'supabase/v18_explore_plans.sql'), 'utf8')
const categories = new Set(PLAN_ITEM_CATEGORIES.map(item => item.key))

test('bangkok seed is a complete checklist and matches the migration', () => {
  assert.equal(BANGKOK_ITEMS.length, 19)
  assert.equal(new Set(BANGKOK_ITEMS.map(item => item.seed_key)).size, 19)
  assert.ok(sql.includes('disable row level security'))
  assert.ok(sql.includes('explore_plans'))
  assert.ok(sql.includes('explore_plan_items'))
  assert.ok(sql.includes(BANGKOK_PLAN.seed_key))
  assert.ok(sql.includes(BANGKOK_PLAN.title))
  for (const item of BANGKOK_ITEMS) {
    assert.ok(categories.has(item.category), item.seed_key)
    assert.ok(sql.includes(item.seed_key), item.seed_key)
    assert.ok(sql.includes(item.title), item.title)
    if (item.image_url) {
      assert.ok(item.image_url.startsWith('https://upload.wikimedia.org/'), item.seed_key)
      assert.ok(sql.includes(item.image_url), item.seed_key)
    } else {
      assert.equal(item.image_url, null)
    }
  }
})

test('beijingToday is a calendar date', () => {
  assert.match(beijingToday(), /^\d{4}-\d{2}-\d{2}$/)
})
