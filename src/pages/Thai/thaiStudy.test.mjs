import test from 'node:test'
import assert from 'node:assert/strict'

const { THAI_LESSONS } = await import('./thaiLessons.js')
const { THAI_GLOSS, ROMAN_READING_GUIDE } = await import('./thaiGloss.js')
const study = await import('./thaiStudy.js')
const { STUDY_DAYS, ITEM_BY_KEY, WORD_BANK, SENTENCE_VOCAB, dayMastery, masteredSet, masteryPatch, resultPatch,
  homeworkQuestions, reviewQuestions, checkAnswer, createRng, makeQuestion, keysForDays, newWordsOn } = study

const THAI_SCRIPT = /[฀-๿]/u

test('gloss covers all 30 days with the same shape as the lessons', () => {
  assert.equal(THAI_GLOSS.length, 30)
  THAI_GLOSS.forEach((g, i) => {
    assert.equal(g.day, i + 1)
    assert.equal(g.words.length, 3, `Day ${g.day} words`)
    assert.equal(g.lines.length, 4, `Day ${g.day} lines`)
    assert.ok(g.scene.emoji.length >= 2 && g.scene.place && g.scene.story)
    assert.ok(g.pattern.formula && g.pattern.meaning && g.pattern.example)
  })
})

test('every word and sentence reads back exactly as the audio roman, token by token', () => {
  for (const d of STUDY_DAYS) {
    for (const item of [...d.words, ...d.lines]) {
      assert.equal(item.tokens.map(t => t.roman).join(' '), item.roman, `${item.id} 对齐`)
      assert.ok(item.tokens.every(t => t.zh), `${item.id} 每个读音都要有中文`)
    }
  }
})

test('nothing shown on the page contains Thai script', () => {
  for (const d of STUDY_DAYS) {
    const shown = [d.title, d.goal, d.scene.place, d.scene.story, d.pattern.formula, d.pattern.meaning, d.pattern.example,
      ...[...d.words, ...d.lines].flatMap(i => [i.zh, i.roman, ...i.tokens.flatMap(t => [t.roman, t.zh])])]
    for (const text of shown) assert.ok(!THAI_SCRIPT.test(text), `Day ${d.day}: ${text}`)
  }
  for (const line of ROMAN_READING_GUIDE) assert.ok(!THAI_SCRIPT.test(line))
})

test('items keep lesson audio ids and dedupe by reading', () => {
  assert.equal(STUDY_DAYS[0].words[0].id, THAI_LESSONS[0].words[0].id)
  assert.equal(ITEM_BY_KEY.get('w:sà-wàt-dii|你好').day, 1)
  assert.deepEqual(WORD_BANK.find(w => w.roman === 'sà-wàt-dii').days, [1, 5])
  assert.equal(WORD_BANK.filter(w => w.roman === 'yen').length, 2, 'yen 冰的 / 傍晚 是两个词')
  assert.equal(newWordsOn(5).length, 0, '回看日不出新词')
  assert.ok(newWordsOn(1).length === 3)
  assert.ok(SENTENCE_VOCAB.every(v => v.roman !== 'khráp'))
})

test('day mastery counts unique items and reaches 100%', () => {
  const none = dayMastery(16, new Set())
  assert.equal(none.pct, 0)
  assert.equal(none.total, 6, '第16天“dâai khráp”出现两次只算一项')
  const all = dayMastery(16, new Set(keysForDays([16])))
  assert.equal(all.pct, 100)
  assert.deepEqual(masteredSet([{ item_key: 'a', mastered: true }, { item_key: 'b', mastered: false }]), new Set(['a']))
})

test('a wrong answer moves a mastered item back; right answers keep it', () => {
  const now = new Date('2026-10-25T03:00:00Z')
  const mastered = masteryPatch(null, 'w:x', true, now)
  assert.equal(mastered.mastered, true)
  assert.equal(mastered.mastered_at, now.toISOString())
  const right = resultPatch(mastered, 'w:x', true, now)
  assert.equal(right.mastered, true)
  assert.equal(right.streak, 1)
  const wrong = resultPatch(right, 'w:x', false, now)
  assert.equal(wrong.mastered, false)
  assert.equal(wrong.wrong_count, 1)
  assert.equal(wrong.streak, 0)
  assert.equal(wrong.last_result, 'wrong')
})

test('homework for every day is answerable with exactly one right option', () => {
  for (let day = 1; day <= 30; day++) {
    const qs = homeworkQuestions(day, createRng(day))
    assert.equal(new Set(qs.map(q => q.itemKey)).size, qs.length, `Day ${day} 不重复出题`)
    assert.ok(qs.length >= 6, `Day ${day} 题量`)
    for (const q of qs) {
      if (q.type === 'build') {
        assert.equal(checkAnswer(q, q.answer), true)
        assert.equal(checkAnswer(q, [...q.answer].reverse()), q.answer.join() === [...q.answer].reverse().join())
        assert.deepEqual(q.chips.map(c => c.roman).sort(), [...q.answer].sort())
      } else {
        assert.equal(q.options.length, 4, `${q.itemKey} ${q.type}`)
        assert.equal(new Set(q.options.map(o => o.label)).size, 4)
        assert.equal(q.options.filter(o => o.correct).length, 1)
        assert.equal(checkAnswer(q, q.options.find(o => o.correct).label), true)
        assert.equal(checkAnswer(q, q.options.find(o => !o.correct).label), false)
        if (q.type === 'cloze') assert.ok(!q.item.tokens[q.blank].fn, '不挖礼貌尾词')
        if (q.type === 'roman2zh' || q.type === 'listen') {
          const sameReading = STUDY_DAYS.flatMap(x => [...x.words, ...x.lines])
            .filter(i => i.kind === q.item.kind && i.roman === q.item.roman).map(i => i.zh)
          for (const o of q.options.filter(o => !o.correct)) assert.ok(!sameReading.includes(o.label), `${q.itemKey} 干扰项“${o.label}”其实也对`)
        }
      }
    }
  }
})

test('review puts wrong answers first and respects the requested size', () => {
  const keys = keysForDays([1, 2, 3])
  const weakKey = keys[keys.length - 1]
  const rows = new Map(keys.map(k => [k, { item_key: k, last_reviewed_at: '2026-10-20T00:00:00Z', last_result: 'right' }]))
  rows.set(weakKey, { item_key: weakKey, last_reviewed_at: '2026-10-24T00:00:00Z', last_result: 'wrong' })
  const qs = reviewQuestions(keys, rows, 3, createRng(7))
  assert.equal(qs.length, 3)
  assert.ok(qs.some(q => q.itemKey === weakKey))
  assert.throws(() => makeQuestion(ITEM_BY_KEY.get(keys[0]), 'nope', createRng(1)))
})
