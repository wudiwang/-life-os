import assert from 'node:assert/strict'
import test from 'node:test'
import { filterLife, groupLifeDays, lifeKey, lifeTime, lifeTokens } from './lifePhrases.js'
import { parseThaiTab } from './thaiProgress.js'

const ROWS = [
  { id: 'a', heard_on: '2026-11-09', heard_at: '2026-11-09T03:20:00Z', kind: 'heard', roman: 'ráp thǔng mǎi khá', zh: '要袋子吗？', gloss: 'ráp=要 | thǔng=袋子 | mǎi=吗 | khá=礼貌' },
  { id: 'b', heard_on: '2026-11-09', heard_at: '2026-11-09T02:00:00Z', kind: 'heard', roman: 'pai nǎi khráp', zh: '去哪里？', gloss: null },
  { id: 'c', heard_on: '2026-11-09', heard_at: '2026-11-09T02:05:00Z', kind: 'wish', roman: 'mâi khûen thaang dùan khráp', zh: '不走高速', said_zh: '（只好摆手）' },
  { id: 'd', heard_on: '2026-11-08', heard_at: null, kind: 'heard', roman: 'khàawp khun khâ', zh: '谢谢' },
]

test('life phrases group by day (newest first) and sort by time; wishes are kept apart', () => {
  const days = groupLifeDays(ROWS)
  assert.deepEqual(days.map(d => d.day), ['2026-11-09', '2026-11-08'])
  assert.deepEqual(days[0].heard.map(r => r.id), ['b', 'a'])
  assert.deepEqual(days[0].wish.map(r => r.id), ['c'])
  assert.deepEqual(groupLifeDays(undefined), [])
  assert.equal(lifeTime('2026-11-09T03:20:00Z'), '10:20')
  assert.equal(lifeTime(null), '')
})

test('word gloss becomes aligned tokens; polite particles are marked; no gloss → one block', () => {
  const t = lifeTokens(ROWS[0])
  assert.deepEqual(t.map(x => x.roman), ['ráp', 'thǔng', 'mǎi', 'khá'])
  assert.equal(t[3].fn, true)
  assert.deepEqual(lifeTokens(ROWS[1]), [{ roman: 'pai', zh: '', fn: false }, { roman: 'nǎi', zh: '', fn: false }, { roman: 'khráp', zh: '', fn: true }])
})

test('mastery keys use a life: prefix; filters pick unmastered or wishes', () => {
  assert.equal(lifeKey(' pai nǎi khráp '), 'life:pai nǎi khráp')
  const mastered = new Set([lifeKey('pai nǎi khráp')])
  assert.deepEqual(filterLife(ROWS, 'todo', mastered).map(r => r.id), ['a', 'c', 'd'])
  assert.deepEqual(filterLife(ROWS, 'wish', mastered).map(r => r.id), ['c'])
  assert.equal(filterLife(ROWS, 'all', mastered).length, 4)
})

test('the life tab has its own address', () => {
  assert.equal(parseThaiTab('#thai-tab=life'), 'life')
  assert.equal(parseThaiTab('#thai-tab=nope'), 'course')
})
