import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { NAV_ITEMS, ALL_TABLES } from '../../lib/constants.js'

test('Thai navigation and scoped progress backup are registered', () => {
  assert.ok(NAV_ITEMS.some(i => i.key === 'thai'))
  for (const t of ['thai_learning_progress', 'thai_item_progress', 'thai_quiz_results']) assert.ok(ALL_TABLES.includes(t), t)
})
test('Thai page is reachable from registry and dashboard', () => {
  assert.match(readFileSync(new URL('../registry.js', import.meta.url), 'utf8'), /thai:\s*ThaiPage/)
  assert.match(readFileSync(new URL('../Dashboard/DailyBoard.jsx', import.meta.url), 'utf8'), /setPage\('thai'\)/)
  assert.ok(existsSync(new URL('./ThaiPage.jsx', import.meta.url)))
})
