import assert from 'node:assert/strict'
import test from 'node:test'
import { THAI_TOPICS, parseTopicKey } from './thaiTopics.js'
import { THAI_LESSONS } from './thaiLessons.js'

const all = THAI_TOPICS.flatMap(t => t.scenes.flatMap(s => [...s.words, ...s.patterns, ...s.dialogue]))

test('every topic entry has a unique ID and the three language fields', () => {
  const ids = new Set()
  for (const e of all) {
    assert.ok(!ids.has(e.id), `Duplicate ID: ${e.id}`)
    ids.add(e.id)
    assert.match(e.th, /[฀-๿]/u, e.id)
    assert.match(e.zh, /[一-鿿]/u, e.id)
    assert.doesNotMatch(e.roman, /[฀-๿一-鿿]/u, e.id)
  }
})

test('each syllable chunk has a Chinese meaning and the chunks rebuild the full reading', () => {
  for (const e of all) {
    assert.ok(e.parts.length > 0, e.id)
    for (const p of e.parts) {
      assert.ok(p.roman && !/[฀-๿一-鿿]/u.test(p.roman), `${e.id}: ${p.roman}`)
      assert.match(p.zh, /[一-鿿]/u, `${e.id}: ${p.roman} needs a meaning`)
    }
    assert.equal(e.parts.map(p => p.roman).join(' '), e.roman, e.id)
  }
})

test('the same Thai text reads the same across the topic and the 30-day course', () => {
  const seen = new Map()
  for (const lesson of THAI_LESSONS) for (const e of [...lesson.words, ...lesson.dialogue]) seen.set(e.th, e.roman)
  for (const e of all) {
    const previous = seen.get(e.th)
    if (previous) assert.equal(e.roman, previous, `${e.id}: ${e.th}`)
    seen.set(e.th, e.roman)
  }
})

test('pattern entries carry a frame and explanation; dialogue lines carry a role', () => {
  for (const t of THAI_TOPICS) for (const s of t.scenes) {
    assert.ok(s.words.length >= 6 && s.patterns.length >= 3 && s.dialogue.length >= 4, s.key)
    for (const p of s.patterns) assert.ok(p.frame && p.frameRoman && p.explain, p.id)
    for (const l of s.dialogue) assert.ok(l.role, l.id)
  }
})

test('topic hash routing only accepts known topics', () => {
  assert.equal(parseTopicKey('#thai-topic=travel'), 'travel')
  assert.equal(parseTopicKey('#thai-topic=nope'), null)
  assert.equal(parseTopicKey('#thai-day=3'), null)
})
