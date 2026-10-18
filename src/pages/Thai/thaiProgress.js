import { THAI_COURSE_VERSION } from './thaiLessons.js'
import { bangkokDay } from '../../lib/dailyActions.js'

export function parseLessonDay(hash) {
  const value = new URLSearchParams(String(hash).replace(/^#/, '')).get('thai-day')
  if (!value || !/^\d{1,2}$/.test(value)) return null
  const day = Number(value)
  return day >= 1 && day <= 30 ? day : null
}

export function validProgress(row) {
  return !!row && row.course_version === THAI_COURSE_VERSION &&
    Number.isInteger(row.lesson_day) && row.lesson_day >= 1 && row.lesson_day <= 30 &&
    typeof row.practiced_at === 'string' && Number.isFinite(Date.parse(row.practiced_at)) &&
    row.practiced_on === bangkokDay(new Date(row.practiced_at))
}

export function nextLessonDay(rows) {
  const practiced = new Set(rows.filter(validProgress).map(row => row.lesson_day))
  for (let day = 1; day <= 30; day++) if (!practiced.has(day)) return day
  return 30
}

export function practiceRow(day, now = new Date()) {
  if (!Number.isInteger(day) || day < 1 || day > 30) throw new Error('课号应为1至30')
  return { course_version: THAI_COURSE_VERSION, lesson_day: day, practiced_at: now.toISOString(), practiced_on: bangkokDay(now) }
}
