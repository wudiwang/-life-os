import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bangkokParts, buildSummaryPrompt, cleanSegments, fallbackSummary, fmtDuration, journalLine,
  markdownFile, parseSummary, recordingTime, safeName, tgMessage, transcriptText,
} from './voice-memos-core.mjs'

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

test('whisper filler lines and repeats are dropped, timestamps kept', () => {
  const segs = cleanSegments([
    { offsets: { from: 0 }, text: ' 今天跟老王开会' },
    { offsets: { from: 4000 }, text: '今天跟老王开会' },
    { offsets: { from: 8000 }, text: '请不吝点赞 订阅 转发 打赏支持明镜与点点栏目' },
    { offsets: { from: 65000 }, text: '先上小仓位试运行' },
    { offsets: { from: 70000 }, text: '字幕由Amara.org社区提供' },
    { offsets: { from: 3725000 }, text: '散会' },
  ])
  assert.deepEqual(segs.map(s => s.text), ['今天跟老王开会', '先上小仓位试运行', '散会'])
  assert.equal(transcriptText(segs), '[00:00] 今天跟老王开会\n[01:05] 先上小仓位试运行\n[1:02:05] 散会')
  assert.deepEqual(cleanSegments(undefined), [])
})

test('very long transcripts are trimmed in the middle before going to the AI', () => {
  const p = buildSummaryPrompt('甲'.repeat(50000) + '乙'.repeat(50000), { hhmm: '10:00', duration: 7200 })
  assert.ok(p.includes('2 小时 0 分钟'))
  assert.ok(p.includes('省略 20000 字'))
  assert.ok(p.length < 82000)
})

const AI = '```json\n{"title":"交易系统上线","kind":"会议","summary":"和老王定了先小仓位试运行。","points":["回测还要跑两周","先上小仓位"],"todos":["周五前把回测补齐"],"insight":null}\n```'

test('AI JSON is parsed even inside a code fence; bad output throws', () => {
  const s = parseSummary(AI)
  assert.equal(s.title, '交易系统上线')
  assert.deepEqual(s.points, ['回测还要跑两周', '先上小仓位'])
  assert.equal(s.insight, null)
  assert.throws(() => parseSummary('抱歉，我无法处理'))
  assert.throws(() => parseSummary('{"summary":"没有标题"}'))
})

test('journal gets one line (the journal page splits content by line)', () => {
  const line = journalLine({ hhmm: '15:54', duration: 1390 }, parseSummary(AI))
  assert.equal(line, '[15:54] 🎙️ 录音 23 分钟 · 交易系统上线｜和老王定了先小仓位试运行。｜要点：①回测还要跑两周 ②先上小仓位｜待办：周五前把回测补齐')
  assert.ok(!line.includes('\n'))
  const multi = journalLine({ hhmm: '09:00', duration: 30 }, { title: '标题\n换行', kind: '其他', summary: '第一句\n第二句', points: [], todos: [], insight: '记住\n这个' })
  assert.ok(!multi.includes('\n'))
})

test('TG message and local markdown carry the summary; the full transcript stays local', () => {
  const s = parseSummary(AI)
  const msg = tgMessage({ hhmm: '15:54', duration: 1390 }, s, '~/Projects/life-os-voice/2026-11/x.md')
  assert.ok(msg.startsWith('🎙️ 录音整理好了（15:54，23 分钟，会议）'))
  assert.ok(msg.includes('☐ 周五前把回测补齐'))
  assert.ok(msg.includes('全文只在 Mac：~/Projects/life-os-voice/2026-11/x.md'))
  const md = markdownFile({ day: '2026-11-09', hhmm: '15:54', duration: 1390, source: 'a.m4a', language: 'zh' }, s, '[00:00] 原文')
  assert.ok(md.startsWith('# 交易系统上线'))
  assert.ok(md.includes('- [ ] 周五前把回测补齐'))
  assert.ok(md.endsWith('[00:00] 原文\n'))
})

test('fallback summary and safe file names', () => {
  const f = fallbackSummary('[00:00] ' + '字'.repeat(200))
  assert.equal(f.summary.length, 122)
  assert.equal(safeName('a/b:c?'), 'a·b·c·')
  assert.equal(safeName('  '), '录音')
})
