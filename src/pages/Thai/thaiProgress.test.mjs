import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const url = new URL('./thaiProgress.js', import.meta.url)
test('Thai progress helpers exist', () => assert.ok(existsSync(url), 'Thai progress helpers not implemented'))
if (existsSync(url)) {
  const { parseLessonDay, nextLessonDay, practiceRow, validProgress } = await import(url)
  test('lesson hash accepts only complete valid day numbers', () => {
    for (let i = 1; i <= 30; i++) assert.equal(parseLessonDay(`#thai-day=${i}`), i)
    for (const hash of ['', '#thai', '#thai-day=0', '#thai-day=31', '#thai-day=1x', '#thai-day=-1', '#thai-day=1.5']) assert.equal(parseLessonDay(hash), null)
  })
  test('progress uses Bangkok date and never claims mastery', () => {
    const row = practiceRow(4, new Date('2026-10-18T18:00:00Z'))
    assert.equal(row.practiced_on, '2026-10-19')
    assert.equal(row.lesson_day, 4)
    assert.equal(row.practiced_at, '2026-10-18T18:00:00.000Z')
    assert.equal('mastered' in row, false)
    assert.throws(() => practiceRow(31))
    assert.throws(() => practiceRow(1, new Date('invalid')))
  })
  test('continue picks first unpracticed, not largest completed plus one', () => {
    assert.equal(nextLessonDay([]), 1)
    assert.equal(nextLessonDay([practiceRow(1), practiceRow(3)]), 2)
    assert.equal(nextLessonDay(Array.from({ length: 30 }, (_, i) => practiceRow(i + 1))), 30)
  })
  test('malformed and outdated course progress is ignored', () => {
    const row = practiceRow(1)
    assert.equal(validProgress(row), true)
    for (const bad of [null, {}, { ...row, course_version: 'old' }, { ...row, lesson_day: 0 }, { ...row, practiced_at: 'x' }, { ...row, practiced_on: undefined }, { ...row, practiced_on: 'garbage' }, { ...row, practiced_on: '2000-01-01' }]) assert.equal(validProgress(bad), false)
    assert.equal(nextLessonDay([{ ...row, course_version: 'old' }]), 1)
  })
}
