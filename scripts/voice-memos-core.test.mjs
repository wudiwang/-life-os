import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bangkokParts, buildSummaryPrompt, buildThaiPrompt, buildTimeline, fallbackSummary, fmtDuration, glossTokens,
  groupSpeech, journalLine, langCode, langStats, markdownFile, parseSummary, parseThai, parseVad, recordingTime,
  safeName, tgMessage, thaiExcerpt, thaiMessage, thaiRows, transcriptText, wavHeader,
} from './voice-memos-core.mjs'

const START = new Date('2026-11-09T02:00:00Z') // 曼谷 09:00 开始录

test('recording time comes from the Voice Memos file name (Bangkok local time), else the file time', () => {
  const t = recordingTime('20261109 155443-6B3F1A2E.m4a', 0)
  assert.equal(t.toISOString(), '2026-11-09T08:54:43.000Z')
  assert.deepEqual(bangkokParts(t), { day: '2026-11-09', hhmm: '15:54' })
  const mtime = Date.parse('2026-11-09T17:30:00Z') // 曼谷已是 11-10 00:30
  assert.deepEqual(bangkokParts(recordingTime('会议.m4a', mtime)), { day: '2026-11-10', hhmm: '00:30' })
})

test('durations read naturally', () => {
  assert.equal(fmtDuration(14.4), '14 秒')
  assert.equal(fmtDuration(23 * 60 + 10), '23 分钟')
  assert.equal(fmtDuration(95 * 60), '1 小时 35 分钟')
})

test('silence-detector output (centiseconds) becomes speech chunks; short pauses merge, long ones split', () => {
  const segs = parseVad('Detected 4 speech segments:\nSpeech segment 0: start = 301.00, end = 547.00\nSpeech segment 1: start = 573.00, end = 825.00\nSpeech segment 2: start = 2259.00, end = 2368.00\nSpeech segment 3: start = 9000.00, end = 9020.00\n')
  assert.deepEqual(segs[0], { start: 3010, end: 5470 })
  const chunks = groupSpeech(segs, { total: 95000 })
  // 0、1 段只停顿 0.26 秒 → 并成一块；2 段隔了 14 秒 → 单独一块；3 段只有 0.2 秒 → 丢掉
  assert.deepEqual(chunks, [{ id: 1, start: 2810, end: 8450 }, { id: 2, start: 22390, end: 23880 }])
  // 一块最长 20 秒：连续说话也会被切开
  const long = groupSpeech(Array.from({ length: 10 }, (_, i) => ({ start: i * 5000, end: i * 5000 + 4800 })))
  assert.ok(long.length >= 3 && long.every(c => c.end - c.start <= 20000 + 400))
})

test('language names map to short codes', () => {
  assert.equal(langCode('thai'), 'th')
  assert.equal(langCode('Chinese'), 'zh')
  assert.equal(langCode('english'), 'en')
  assert.equal(langCode(''), '?')
})

const RESULTS = [
  { id: 1, start: 0, end: 4000, lang: 'zh', text: ' 我要一杯冰美式' },
  { id: 2, start: 5000, end: 9000, lang: 'th', text: 'เอาอเมริกาโน่เย็นไหมคะ' },
  { id: 3, start: 9500, end: 12000, lang: 'th', text: 'เอาอเมริกาโน่เย็นไหมคะ' },
  { id: 4, start: 13000, end: 15000, lang: 'zh', text: '请不吝点赞 订阅 转发 打赏支持明镜与点点栏目' },
  { id: 5, start: 16000, end: 18000, lang: 'th', text: 'ขอบคุณที่รับชม' },
  { id: 6, start: 3_600_000, end: 3_605_000, lang: 'th', text: 'ทั้งหมดแปดสิบห้าบาทค่ะ' },
  { id: 7, start: 3_606_000, end: 3_608_000, lang: 'en', text: 'OK thank you' },
]

test('timeline drops whisper filler lines (Chinese and Thai) and repeats, keeps clock times and languages', () => {
  const tl = buildTimeline(RESULTS)
  assert.deepEqual(tl.map(s => s.id), [1, 2, 6, 7])
  assert.equal(transcriptText(tl, START), '[09:00 中] 我要一杯冰美式\n[09:00 泰] เอาอเมริกาโน่เย็นไหมคะ\n[10:00 泰] ทั้งหมดแปดสิบห้าบาทค่ะ\n[10:00 英] OK thank you')
  const st = langStats(tl)
  assert.equal(st.thaiLines, 2)
  assert.equal(st.th, 9)
  assert.deepEqual(buildTimeline(undefined), [])
})

test('Thai excerpt numbers each Thai line and carries the Chinese/English around it as context', () => {
  const ex = thaiExcerpt(buildTimeline(RESULTS), START)
  assert.equal(ex, '   09:00 中：我要一杯冰美式\n#2 09:00 泰：เอาอเมริกาโน่เย็นไหมคะ\n……\n#6 10:00 泰：ทั้งหมดแปดสิบห้าบาทค่ะ\n   10:00 英：OK thank you')
  assert.equal(thaiExcerpt([{ id: 1, start: 0, end: 1, lang: 'zh', text: '只有中文' }], START), '')
  const p = buildThaiPrompt(ex, { day: '2026-11-09', duration: 36000 })
  assert.ok(p.includes('10 小时 0 分钟'))
  assert.ok(p.includes('khráp'))
  assert.ok(p.includes('#6 10:00'))
})

test('very long transcripts are trimmed in the middle before going to the AI', () => {
  const p = buildSummaryPrompt('甲'.repeat(50000) + '乙'.repeat(50000), { hhmm: '10:00', duration: 7200 })
  assert.ok(p.includes('2 小时 0 分钟'))
  assert.ok(p.includes('省略 20000 字'))
  assert.ok(p.length < 83000)
})

const AI = '```json\n{"title":"交易系统上线","kind":"会议","summary":"和老王定了先小仓位试运行。","points":["回测还要跑两周","先上小仓位"],"todos":["周五前把回测补齐"],"insight":null}\n```'

test('AI summary JSON is parsed even inside a code fence; bad output throws', () => {
  const s = parseSummary(AI)
  assert.equal(s.title, '交易系统上线')
  assert.deepEqual(s.points, ['回测还要跑两周', '先上小仓位'])
  assert.equal(s.insight, null)
  assert.throws(() => parseSummary('抱歉，我无法处理'))
  assert.throws(() => parseSummary('{"summary":"没有标题"}'))
})

const THAI_AI = JSON.stringify({
  note: '上午在咖啡店和 7-11 用了泰语。',
  phrases: [
    { clip: 2, time: '9:00', scene: '咖啡店点单', who: '店员', thai: 'เอาอเมริกาโน่เย็นไหมคะ', roman: 'ao a-me-ri-kaa-nôo yen mǎi khá', zh: '要冰美式吗？', gloss: 'ao=要 | a-me-ri-kaa-nôo=美式咖啡 | yen=冰的 | mǎi=吗 | khá=礼貌' },
    { clip: 6, time: '10:00', scene: '7-11 结账', who: '店员', thai: 'ทั้งหมดแปดสิบห้าบาทค่ะ', roman: 'tháng-mòt pàaet-sìp-hâa bàat khâ', zh: '一共 85 铢', gloss: 'tháng-mòt=一共 | pàaet-sìp-hâa=八十五 | bàat=泰铢 | khâ=礼貌' },
    { clip: 9, time: '10:01', thai: 'ทั้งหมดแปดสิบห้าบาทค่ะ', roman: 'tháng-mòt pàaet-sìp-hâa bàat khâ', zh: '重复的' },
    { thai: 'no thai here', roman: 'x', zh: '没有泰文的丢掉' },
    { thai: 'ขอถุงด้วย', roman: 'khǎaw thǔng dûai', zh: '请给个袋子', gloss: 'khǎaw=请给我 | thǔng | dûai=也' },
  ],
  wish: [{ time: '10:00', scene: '7-11', said: 'OK thank you', thai: 'ขอบคุณครับ', roman: 'khàawp khun khráp', zh: '谢谢', gloss: 'khàawp khun=谢谢 | khráp=礼貌' }],
})

test('Thai AI result: phrases need Thai script, readings follow the word gloss, duplicates and broken gloss handled', () => {
  const t = parseThai(THAI_AI)
  assert.equal(t.phrases.length, 3)
  assert.equal(t.phrases[0].time, '09:00')
  assert.equal(t.phrases[0].clip, 2)
  assert.equal(t.phrases[2].gloss, null) // thǔng 没给中文 → 不显示逐词，只显示整句
  assert.equal(t.wish[0].said, 'OK thank you')
  assert.equal(t.wish[0].who, '我')
  assert.deepEqual(glossTokens('khǎaw=请给我 | thǔng=袋子'), [{ roman: 'khǎaw', zh: '请给我' }, { roman: 'thǔng', zh: '袋子' }])
  const rows = thaiRows('2026-11-09', t, 'a.m4a')
  assert.equal(rows.length, 4)
  assert.equal(rows[0].heard_at, '2026-11-09T02:00:00.000Z')
  assert.equal(rows[3].kind, 'wish')
  assert.equal(rows[3].said_zh, 'OK thank you')
  const msg = thaiMessage({ day: '2026-11-09' }, t, { th: 9 }, 'https://x/?page=thai#thai-tab=life')
  assert.ok(msg.startsWith('🇹🇭 2026-11-09 的生活泰语（录音里泰语约 9 秒）'))
  assert.ok(msg.includes('1. ao a-me-ri-kaa-nôo yen mǎi khá'))
  assert.ok(msg.includes('「OK thank you」→ khàawp khun khráp（谢谢）'))
})

test('journal gets one line (the journal page splits content by line)', () => {
  const line = journalLine({ hhmm: '15:54', duration: 1390 }, parseSummary(AI), 4)
  assert.equal(line, '[15:54] 🎙️ 录音 23 分钟 · 交易系统上线｜和老王定了先小仓位试运行。｜要点：①回测还要跑两周 ②先上小仓位｜待办：周五前把回测补齐｜生活泰语 4 句')
  const multi = journalLine({ hhmm: '09:00', duration: 30 }, { title: '标题\n换行', kind: '其他', summary: '第一句\n第二句', points: [], todos: [], insight: '记住\n这个' })
  assert.ok(!multi.includes('\n'))
})

test('TG message and local markdown carry the summary; the full transcript stays local', () => {
  const s = parseSummary(AI)
  const msg = tgMessage({ hhmm: '15:54', duration: 1390 }, s, '~/Projects/life-os-voice/2026-11/x.md')
  assert.ok(msg.startsWith('🎙️ 录音整理好了（15:54，23 分钟，会议）'))
  assert.ok(msg.includes('☐ 周五前把回测补齐'))
  const md = markdownFile({ day: '2026-11-09', hhmm: '15:54', duration: 1390, source: 'a.m4a', stats: { zh: 600, th: 120, en: 0 } }, s, '[09:00 中] 原文', parseThai(THAI_AI))
  assert.ok(md.startsWith('# 交易系统上线'))
  assert.ok(md.includes('泰语 2 分钟'))
  assert.ok(md.includes('## 生活泰语'))
  assert.ok(md.endsWith('[09:00 中] 原文\n'))
})

test('fallback summary, safe file names, wav header', () => {
  const f = fallbackSummary('[09:00 中] ' + '字'.repeat(200))
  assert.equal(f.summary.length, 122)
  assert.equal(safeName('a/b:c?'), 'a·b·c·')
  assert.equal(safeName('  '), '录音')
  const h = wavHeader(32000)
  assert.equal(h.length, 44)
  assert.equal(h.readUInt32LE(40), 32000)
  assert.equal(h.readUInt32LE(24), 16000)
})
