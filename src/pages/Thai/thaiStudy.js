// 学习数据与出题逻辑（纯函数，可测）。泰文只用于音频，不出现在这里返回的展示字段里。
import { THAI_COURSE_VERSION, THAI_LESSONS } from './thaiLessons.js'
import { THAI_GLOSS, GLOSS_DEFAULTS, FUNCTION_WORDS } from './thaiGloss.js'

export function parseTokens(spec) {
  return spec.split('|').map(part => {
    const [roman, zh] = part.split('=').map(s => s?.trim())
    const gloss = zh || GLOSS_DEFAULTS[roman]
    if (!roman || !gloss) throw new Error(`缺少释义：${part}`)
    return { roman, zh: gloss, fn: FUNCTION_WORDS.has(roman) }
  })
}

export const STUDY_DAYS = THAI_LESSONS.map(lesson => {
  const gloss = THAI_GLOSS[lesson.day - 1]
  return {
    day: lesson.day,
    title: lesson.title,
    goal: lesson.goal,
    scene: gloss.scene,
    pattern: gloss.pattern,
    words: lesson.words.map((w, i) => ({
      // 同音不同义（如 yen：冰的 / 傍晚）要分开记，所以词的 key 带上中文。
      id: w.id, key: `w:${w.roman}|${w.zh}`, kind: 'word', day: lesson.day,
      roman: w.roman, zh: w.zh, icon: gloss.words[i].icon, tokens: parseTokens(gloss.words[i].tokens),
    })),
    lines: lesson.dialogue.map((l, i) => ({
      id: l.id, key: `l:${l.roman}`, kind: 'line', day: lesson.day,
      role: l.role, roman: l.roman, zh: l.zh, tokens: parseTokens(gloss.lines[i]),
    })),
  }
})

// 同一读音只算一个学习项，取第一次出现的那条（音频、图标都用它）。
export const ITEM_BY_KEY = new Map()
for (const d of STUDY_DAYS) for (const item of [...d.words, ...d.lines]) {
  if (!ITEM_BY_KEY.has(item.key)) ITEM_BY_KEY.set(item.key, item)
}

export function studyDay(day) {
  return STUDY_DAYS[day - 1] || null
}

export function dayKeys(day) {
  const d = studyDay(day)
  return d ? [...new Set([...d.words, ...d.lines].map(i => i.key))] : []
}

export function masteredSet(rows) {
  return new Set(rows.filter(r => r.mastered).map(r => r.item_key))
}

export function dayMastery(day, mastered) {
  const keys = dayKeys(day)
  const done = keys.filter(k => mastered.has(k)).length
  return { done, total: keys.length, pct: keys.length ? Math.round(done / keys.length * 100) : 0 }
}

export const ALL_KEYS = [...ITEM_BY_KEY.keys()]
export const WORD_KEYS = ALL_KEYS.filter(k => k.startsWith('w:'))
export const LINE_KEYS = ALL_KEYS.filter(k => k.startsWith('l:'))

// 单词本：每个核心词第一次出现在哪天，之后在哪些天复现。
export const WORD_BANK = WORD_KEYS.map(key => {
  const item = ITEM_BY_KEY.get(key)
  const days = STUDY_DAYS.filter(d => d.words.some(w => w.key === key)).map(d => d.day)
  return { ...item, firstDay: days[0], days }
})

export function newWordsOn(day) {
  return WORD_BANK.filter(w => w.firstDay === day)
}

// 句子里顺带学到的词（不含礼貌尾词），按首次出现的天归档。
export const SENTENCE_VOCAB = (() => {
  const seen = new Map()
  for (const d of STUDY_DAYS) for (const line of d.lines) for (const t of line.tokens) {
    if (!t.fn && !seen.has(t.roman)) seen.set(t.roman, { roman: t.roman, zh: t.zh, firstDay: d.day })
  }
  return [...seen.values()]
})()

// ── 掌握记录 ──

export function masteryPatch(prev, key, mastered, now = new Date()) {
  return {
    ...baseRow(prev, key, now),
    mastered,
    mastered_at: mastered ? (prev?.mastered && prev.mastered_at) || now.toISOString() : null,
  }
}

// 答错一次就移回“待掌握”：掌握标记要经得起考。
export function resultPatch(prev, key, correct, now = new Date()) {
  const row = baseRow(prev, key, now)
  return {
    ...row,
    correct_count: row.correct_count + (correct ? 1 : 0),
    wrong_count: row.wrong_count + (correct ? 0 : 1),
    streak: correct ? row.streak + 1 : 0,
    last_result: correct ? 'right' : 'wrong',
    last_reviewed_at: now.toISOString(),
    mastered: correct ? row.mastered : false,
    mastered_at: correct ? row.mastered_at : null,
  }
}

function baseRow(prev, key, now) {
  return {
    course_version: THAI_COURSE_VERSION,
    item_key: key,
    mastered: !!prev?.mastered,
    mastered_at: prev?.mastered_at ?? null,
    correct_count: prev?.correct_count ?? 0,
    wrong_count: prev?.wrong_count ?? 0,
    streak: prev?.streak ?? 0,
    last_result: prev?.last_result ?? null,
    last_reviewed_at: prev?.last_reviewed_at ?? null,
    updated_at: now.toISOString(),
  }
}

export function isWeak(row) {
  return !!row && row.last_result === 'wrong'
}

// ── 出题 ──

export function createRng(seed = Date.now()) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(list, rng) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function pickDistinct(pool, count, rng, exclude) {
  const used = new Set(exclude)
  const out = []
  for (const value of shuffle(pool, rng)) {
    if (out.length >= count) break
    if (used.has(value)) continue
    used.add(value)
    out.push(value)
  }
  return out
}

function choiceOptions(correct, pool, rng, exclude = []) {
  const wrong = pickDistinct(pool, 3, rng, [correct, ...exclude])
  return shuffle([correct, ...wrong], rng).map(label => ({ label, correct: label === correct }))
}

const WORD_ROMANS = WORD_BANK.map(w => w.roman)
const WORD_ZHS = [...new Set(WORD_BANK.map(w => w.zh))]
const LINE_ZHS = [...new Set(LINE_KEYS.map(k => ITEM_BY_KEY.get(k).zh))]
const VOCAB_ROMANS = SENTENCE_VOCAB.map(v => v.roman)

// 同一读音的所有中文说法：选中文时都不能当干扰项（dâai khráp 既是“可以”也是“好的”）。
const ZHS_BY_ROMAN = new Map()
for (const d of STUDY_DAYS) for (const item of [...d.words, ...d.lines]) {
  const id = `${item.kind}:${item.roman}`
  ZHS_BY_ROMAN.set(id, [...new Set([...(ZHS_BY_ROMAN.get(id) || []), item.zh])])
}
const sameReadingZhs = item => ZHS_BY_ROMAN.get(`${item.kind}:${item.roman}`) || []

function contentTokenIndexes(item) {
  return item.tokens.map((t, i) => (t.fn ? -1 : i)).filter(i => i >= 0)
}

export function canBuild(item) {
  return item.kind === 'line' && item.tokens.length >= 3
}

export function makeQuestion(item, type, rng) {
  const base = { type, itemKey: item.key, audioId: item.id, item }
  if (type === 'zh2roman') return { ...base, options: choiceOptions(item.roman, WORD_ROMANS, rng) }
  if (type === 'roman2zh') return { ...base, options: choiceOptions(item.zh, WORD_ZHS, rng, sameReadingZhs(item)) }
  if (type === 'listen') return { ...base, options: choiceOptions(item.zh, item.kind === 'word' ? WORD_ZHS : LINE_ZHS, rng, sameReadingZhs(item)) }
  if (type === 'build') {
    const chips = shuffle(item.tokens.map((t, i) => ({ i, roman: t.roman })), rng)
    return { ...base, chips, answer: item.tokens.map(t => t.roman) }
  }
  if (type === 'cloze') {
    const indexes = contentTokenIndexes(item)
    const blank = indexes[Math.floor(rng() * indexes.length)]
    const token = item.tokens[blank]
    // 干扰项避开同一句里已有的词，免得两个选项都“说得通”。
    const inLine = item.tokens.map(t => t.roman)
    const wrong = pickDistinct(VOCAB_ROMANS, 3, rng, inLine)
    return { ...base, blank, options: shuffle([token.roman, ...wrong], rng).map(label => ({ label, correct: label === token.roman })) }
  }
  throw new Error(`未知题型：${type}`)
}

export function checkAnswer(question, answer) {
  if (question.type === 'build') {
    return Array.isArray(answer) && answer.length === question.answer.length && answer.every((r, i) => r === question.answer[i])
  }
  return !!question.options.find(o => o.label === answer)?.correct
}

const WORD_TYPES = ['zh2roman', 'roman2zh', 'listen']

function lineType(item, rng) {
  if (canBuild(item) && contentTokenIndexes(item).length >= 2) return rng() < 0.6 ? 'build' : 'cloze'
  return 'listen'
}

// 当天作业：每个词一题（题型轮换），每句一题（能拼就拼，短句听音选义）。
export function homeworkQuestions(day, rng = createRng()) {
  const d = studyDay(day)
  if (!d) return []
  const seen = new Set()
  const out = []
  d.words.forEach((w, i) => {
    if (seen.has(w.key)) return
    seen.add(w.key)
    out.push(makeQuestion(w, WORD_TYPES[(i + day) % 3], rng))
  })
  d.lines.forEach(line => {
    if (seen.has(line.key)) return
    seen.add(line.key)
    const type = line.role === '你' && canBuild(line) ? 'build' : lineType(line, rng)
    out.push(makeQuestion(line, type, rng))
  })
  return out
}

// 复习：错题优先，其次没复习过的，再按上次复习时间从远到近。
export function reviewQuestions(keys, rowsByKey, count = 10, rng = createRng()) {
  const tier = key => {
    const row = rowsByKey.get(key)
    if (isWeak(row)) return 0
    if (!row?.last_reviewed_at) return 1
    return 2
  }
  const ordered = shuffle(keys, rng).sort((a, b) => {
    const diff = tier(a) - tier(b)
    if (diff) return diff
    const ta = rowsByKey.get(a)?.last_reviewed_at || ''
    const tb = rowsByKey.get(b)?.last_reviewed_at || ''
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })
  return shuffle(ordered.slice(0, count), rng).map(key => {
    const item = ITEM_BY_KEY.get(key)
    const type = item.kind === 'word' ? WORD_TYPES[Math.floor(rng() * 3)] : lineType(item, rng)
    return makeQuestion(item, type, rng)
  })
}

export function keysForDays(days) {
  return [...new Set(days.flatMap(dayKeys))]
}
