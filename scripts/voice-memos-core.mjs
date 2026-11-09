// 录音整理的纯函数：认录音时间、切分说话段、清洗转写、拼提示词、解析 AI 结果、
// 生成日记行 / 生活泰语 / TG 消息 / 本机全文。不碰文件和网络，测试见 voice-memos-core.test.mjs。
// 流程和用法见 voice-memos.mjs。
import { GLOSS_DEFAULTS, ROMAN_READING_GUIDE } from '../src/pages/Thai/thaiGloss.js'

export const AUDIO_EXT = /\.(m4a|qta|caf|wav|mp3|aac)$/i
export const MIN_SECONDS = 2 // 短于 2 秒的多半是误触

const pad = n => String(n).padStart(2, '0')
const BKK = 7 * 3600 * 1000

// 语音备忘录的文件名形如「20261109 155443-6B3F1A2E.m4a」（录音设备的本地时间，人在曼谷按 +07:00）；
// 认不出就用文件修改时间
export function recordingTime(name, mtimeMs) {
  const m = String(name).match(/^(\d{4})(\d{2})(\d{2})[ _-]?(\d{2})(\d{2})(\d{2})/)
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`
    if (!Number.isNaN(Date.parse(iso))) return new Date(iso)
  }
  return new Date(mtimeMs)
}

// 曼谷时间的 日期 / 时:分
export function bangkokParts(date) {
  const d = new Date(date.getTime() + BKK)
  return {
    day: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hhmm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  }
}

export function fmtDuration(sec) {
  const s = Math.round(Number(sec) || 0)
  if (s < 60) return `${s} 秒`
  const m = Math.round(s / 60)
  return m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`
}

// ── 切分：静音检测给出一段段说话，合并成一块块送去识别 ──

// whisper-vad-speech-segments 的输出（单位：百分之一秒）→ [{start, end}]（毫秒）
export function parseVad(text) {
  return [...String(text || '').matchAll(/start\s*=\s*([\d.]+),\s*end\s*=\s*([\d.]+)/g)]
    .map(m => ({ start: Math.round(Number(m[1]) * 10), end: Math.round(Number(m[2]) * 10) }))
    .filter(s => s.end > s.start)
}

// 停顿很短的相邻段并成一块（同一个人一口气说的），但一块不超过 maxLen，
// 免得一块里既有我的中文又有对方的泰语（每块只能认一个语种）。太短的块丢掉（咳嗽、关门声）。
export function groupSpeech(segs, { maxGap = 700, maxLen = 20000, pad: padMs = 200, minLen = 500, total = Infinity } = {}) {
  const out = []
  for (const s of segs) {
    const last = out[out.length - 1]
    if (last && s.start - last.end <= maxGap && s.end - last.start <= maxLen) last.end = s.end
    else out.push({ start: s.start, end: s.end })
  }
  return out
    .filter(c => c.end - c.start >= minLen)
    .map((c, i) => ({ id: i + 1, start: Math.max(0, c.start - padMs), end: Math.min(total, c.end + padMs) }))
}

// whisper 返回的语种名 → 简写
const LANG = { thai: 'th', chinese: 'zh', english: 'en', japanese: 'ja', korean: 'ko', lao: 'lo', burmese: 'my', khmer: 'km', vietnamese: 'vi' }
export const langCode = name => LANG[String(name || '').toLowerCase()] || String(name || '').toLowerCase().slice(0, 2) || '?'
const LANG_LABEL = { th: '泰', zh: '中', en: '英' }
const langLabel = l => LANG_LABEL[l] || '其他'

// whisper 在安静或嘈杂处常「脑补」视频网站的片尾语，整句命中就丢掉
const HALLUCINATION = /点赞|订阅|打赏|明镜|Amara|字幕|感谢观看|谢谢观看|谢谢收看|谢谢大家收看|优优独播|YoYo|ขอบคุณที่รับชม|ติดตามตอนต่อไป|กดไลค์|กดติดตาม|กดกระดิ่ง|ซับไทย|thank you for watching|please subscribe|subtitles? by/i

// 每块的识别结果 → 时间线：去掉脑补句和空白，连着重复的同一句只留一次
export function buildTimeline(results) {
  const out = []
  for (const r of results || []) {
    const text = String(r.text || '').replace(/\s+/g, ' ').trim()
    if (!text || HALLUCINATION.test(text)) continue
    if (out.length && out[out.length - 1].text === text) continue
    out.push({ id: r.id, start: r.start, end: r.end, lang: r.lang || '?', prob: r.prob ?? null, text })
  }
  return out
}

const clock = (startDate, ms) => {
  const d = new Date(startDate.getTime() + ms + BKK)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// 全文：[13:20 泰] สวัสดีครับ（钟点 = 录音开始时间 + 偏移，比「第几分钟」好认）
export const transcriptText = (timeline, startDate) =>
  timeline.map(s => `[${clock(startDate, s.start)} ${langLabel(s.lang)}] ${s.text}`).join('\n')

export function langStats(timeline) {
  const sec = { th: 0, zh: 0, en: 0, other: 0 }
  for (const s of timeline) sec[s.lang in sec ? s.lang : 'other'] += (s.end - s.start) / 1000
  return { ...sec, thaiLines: timeline.filter(s => s.lang === 'th').length }
}

const MAX_PROMPT_CHARS = 80000

function trimMiddle(body, max = MAX_PROMPT_CHARS) {
  if (body.length <= max) return body
  const half = max / 2
  return `${body.slice(0, half)}\n……（中间太长，省略 ${body.length - max} 字）……\n${body.slice(-half)}`
}

export function buildSummaryPrompt(transcript, { hhmm, duration }) {
  return `下面是我随身录的一段音（${hhmm} 开始，时长 ${fmtDuration(duration)}），经本机语音识别转成的文字，每行开头是钟点和语种（中/泰/英）。
可能是我和别人的对话、会议，也可能是我自言自语，或者是一整天的随身录音。没有标注谁在说话，「我」= 录音的人（中国人，住在曼谷）。
语音识别会有同音错字（比如把「仓位」写成「舱位」、「吃」写成「吹」），请按上下文理解，但不要编造没说过的内容。

请整理成 JSON（只输出 JSON，不要其他文字）：
{
  "title": "不超过 15 个字的标题",
  "kind": "对话 / 会议 / 自言自语 / 课堂 / 全天 / 其他 选一个",
  "summary": "2-3 句话说清楚讲了什么、结论是什么，用第一人称；全天录音就按时间顺序概括这一天",
  "points": ["要点，最多 6 条，每条一句话"],
  "todos": ["明确要去做的事，没有就空数组，最多 5 条"],
  "insight": "这段录音里值得记住的一句启示，没有就 null"
}

规则：
- 全部简体中文。
- 不要写进密码、密钥、验证码、账号、证件号、银行卡号这类敏感信息，也不要写别人的全名（整理结果会存到网上的日记里）。
- 如果全是噪音、听不出在说什么，title 写「没有有效内容」，其他字段留空。

转写原文：
${trimMiddle(transcript)}`
}

const strList = (v, max) => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, max)

function jsonBody(text) {
  let body = String(text || '').trim()
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) body = fenced[1].trim()
  const a = body.indexOf('{'), b = body.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('AI 没有返回 JSON')
  return JSON.parse(body.slice(a, b + 1))
}

export function parseSummary(text) {
  const j = jsonBody(text)
  const title = String(j.title || '').trim()
  if (!title) throw new Error('AI 返回缺少 title')
  return {
    title: title.slice(0, 30),
    kind: String(j.kind || '').trim() || '其他',
    summary: String(j.summary || '').trim(),
    points: strList(j.points, 6),
    todos: strList(j.todos, 5),
    insight: j.insight ? String(j.insight).trim() : null,
  }
}

// AI 连续失败时的保底：标题 + 开头一段原文
export function fallbackSummary(transcript) {
  const plain = transcript.replace(/^\[[^\]]*\]\s*/gm, '').replace(/\s+/g, ' ').trim()
  return { title: '录音（AI 未整理）', kind: '其他', summary: plain.slice(0, 120) + (plain.length > 120 ? '……' : ''), points: [], todos: [], insight: null }
}

// ── 生活泰语 ──

const THAI_CHARS = /[฀-๿]/

// 给 AI 的泰语摘录：每句泰语带编号（#12，用来回找原声片段），前后若是中文/英语就带上当上下文
export function thaiExcerpt(timeline, startDate, max = 60000) {
  const keep = new Set()
  timeline.forEach((s, i) => {
    if (s.lang !== 'th' || !THAI_CHARS.test(s.text)) return
    keep.add(i)
    if (i > 0 && timeline[i - 1].lang !== 'th') keep.add(i - 1)
    if (i + 1 < timeline.length && timeline[i + 1].lang !== 'th') keep.add(i + 1)
  })
  const lines = []
  let prev = -2
  for (const i of [...keep].sort((a, b) => a - b)) {
    const s = timeline[i]
    // 中间跳过了句子，或隔了 5 分钟以上（多半换了场景），用「……」隔开
    if (lines.length && (i !== prev + 1 || s.start - timeline[prev].end > 300000)) lines.push('……')
    lines.push(`${s.lang === 'th' ? `#${s.id} ` : '   '}${clock(startDate, s.start)} ${langLabel(s.lang)}：${s.text}`)
    prev = i
  }
  const text = lines.join('\n')
  return text.length > max ? `${text.slice(0, max)}\n……（后面还有 ${text.length - max} 字，省略）` : text
}

const GLOSS_EXAMPLES = Object.entries(GLOSS_DEFAULTS).map(([r, z]) => `${r}=${z}`).join(' | ')

export function buildThaiPrompt(excerpt, { day, duration }) {
  return `我是住在曼谷的中国人，正在学泰语口语。下面是我 ${day} 随身录音（共 ${fmtDuration(duration)}）里识别出的泰语句子，
带编号的是泰语原句（#编号 钟点 泰：…），没编号的是前后的中文/英语，供你判断场景。语音识别会有错字，请按上下文改成自然、正确的泰语。

请帮我挑出最值得学的「生活泰语」，整理成 JSON（只输出 JSON）：
{
  "note": "一句话概括今天在哪些场景接触了泰语",
  "phrases": [
    { "clip": 12, "time": "13:20", "scene": "7-11 结账", "who": "店员",
      "thai": "泰文（改正后的）", "roman": "读音", "zh": "整句的中文意思",
      "gloss": "读音=中文 | 读音=中文" }
  ],
  "wish": [
    { "time": "15:05", "scene": "打车", "said": "我当时用中文或英语说的原话",
      "thai": "这句话的泰语", "roman": "读音", "zh": "中文意思", "gloss": "读音=中文 | 读音=中文" }
  ]
}

挑选规则：
- phrases 最多 12 条：挑我以后还会听到或用到的（点单、付钱、问路、打招呼、服务场景、常用回应），短句优先（不超过 12 个词），长句拆成好用的短句。
- clip 填这句来自哪个编号；时间填那一行的钟点。who 填说话人（我 / 店员 / 司机 / 朋友 / 路人 / 电视 / 不确定）。
- 电视、广告、背景音乐、听不清的跳过；不要收人名、电话、地址等隐私信息。同一句只收一次。
- wish 最多 5 条：我用中文或英语跟人交流、或明显不会用泰语表达的时刻，给出泰语说法。没有就空数组。
- 一句能用的泰语都没有，phrases 和 wish 都给空数组。

读音和逐词释义的写法（必须和我课程里的一致，页面只显示读音和中文，不显示泰文）：
${ROMAN_READING_GUIDE.map(s => `- ${s}`).join('\n')}
- 我是男性，礼貌尾音用 khráp；店员等女性说话保留 khâ。
- gloss 按词切开，每个词写成「读音=中文」，用「 | 」隔开；所有词的读音按顺序用空格连起来必须正好等于 roman。
- 例子：${GLOSS_EXAMPLES}

泰语摘录：
${excerpt}`
}

// 'khǎaw=请给我 | thǔng=袋子' → [{roman, zh}]；坏的片段直接跳过
export function glossTokens(gloss) {
  return String(gloss || '').split('|').map(part => {
    const [roman, ...zh] = part.split('=')
    return { roman: (roman || '').trim(), zh: zh.join('=').trim() }
  }).filter(t => t.roman)
}

const short = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n)

function cleanPhrase(p, wish) {
  const thai = short(p.thai, 200)
  let roman = short(p.roman, 200)
  const zh = short(p.zh, 120)
  if (!THAI_CHARS.test(thai) || !roman || !zh) return null
  const tokens = glossTokens(p.gloss)
  // 释义的读音拼起来要等于整句读音；对不上时以释义为准（页面逐词显示的就是它）
  const joined = tokens.map(t => t.roman).join(' ')
  if (tokens.length && tokens.every(t => t.zh)) roman = joined
  const gloss = tokens.length && tokens.every(t => t.zh) ? tokens.map(t => `${t.roman}=${t.zh}`).join(' | ') : null
  const time = /^\d{1,2}:\d{2}$/.test(String(p.time || '').trim()) ? String(p.time).trim().padStart(5, '0') : null
  return {
    thai, roman, zh, gloss, time,
    scene: short(p.scene, 40) || null,
    who: wish ? '我' : short(p.who, 12) || null,
    said: wish ? short(p.said, 200) || null : null,
    clip: wish ? null : (Number.isInteger(Number(p.clip)) && Number(p.clip) > 0 ? Number(p.clip) : null),
  }
}

export function parseThai(text) {
  const j = jsonBody(text)
  const uniq = (list, max, wish) => {
    const seen = new Set()
    return (Array.isArray(list) ? list : []).map(p => cleanPhrase(p || {}, wish)).filter(p => {
      if (!p || seen.has(p.roman)) return false
      seen.add(p.roman)
      return true
    }).slice(0, max)
  }
  return { note: short(j.note, 200), phrases: uniq(j.phrases, 12, false), wish: uniq(j.wish, 5, true) }
}

// 写进 thai_life_phrases 的行（heard_at = 当天那个钟点，曼谷时间）
export function thaiRows(day, thai, source) {
  const at = t => (t ? new Date(`${day}T${t}:00+07:00`).toISOString() : null)
  const row = (p, kind) => ({
    heard_on: day, heard_at: at(p.time), kind, thai: p.thai, roman: p.roman, zh: p.zh,
    gloss: p.gloss, scene: p.scene, who: p.who, said_zh: p.said, source,
  })
  return [...thai.phrases.map(p => row(p, 'heard')), ...thai.wish.map(p => row(p, 'wish'))]
}

export function thaiMessage({ day }, thai, stats, link) {
  const lines = [`🇹🇭 ${day} 的生活泰语（录音里泰语约 ${fmtDuration(stats.th)}）`]
  if (thai.note) lines.push(thai.note)
  thai.phrases.forEach((p, i) => {
    lines.push('', `${i + 1}. ${p.roman}`, `   ${p.zh}${p.scene || p.who ? ` —— ${[p.time, p.scene, p.who].filter(Boolean).join(' · ')}` : ''}`)
  })
  if (thai.wish.length) {
    lines.push('', '💬 当时想说的，泰语这么说：')
    for (const w of thai.wish) lines.push(`· ${w.said ? `「${w.said}」→ ` : ''}${w.roman}（${w.zh}）`)
  }
  if (link) lines.push('', `复习：${link}`)
  return lines.join('\n')
}

// ── 日记行 / TG / 本机全文 ──

const oneLine = s => String(s || '').replace(/\s+/g, ' ').trim()
const circled = i => '①②③④⑤⑥⑦⑧⑨⑩'[i] || `${i + 1}.`

// 每日一记的 content 一行一条（[HH:MM] 开头），所以整段录音压成一行
export function journalLine({ hhmm, duration }, s, thaiCount = 0) {
  const parts = [`[${hhmm}] 🎙️ 录音 ${fmtDuration(duration)} · ${oneLine(s.title)}`]
  if (s.summary) parts.push(oneLine(s.summary))
  if (s.points.length) parts.push(`要点：${s.points.map((p, i) => circled(i) + oneLine(p)).join(' ')}`)
  if (s.todos.length) parts.push(`待办：${s.todos.map(oneLine).join('；')}`)
  if (s.insight) parts.push(`启示：${oneLine(s.insight)}`)
  if (thaiCount) parts.push(`生活泰语 ${thaiCount} 句`)
  return parts.join('｜')
}

export function tgMessage({ hhmm, duration }, s, localPath) {
  const lines = [`🎙️ 录音整理好了（${hhmm}，${fmtDuration(duration)}，${s.kind}）`, `「${s.title}」`]
  if (s.summary) lines.push('', s.summary)
  if (s.points.length) lines.push('', '要点：', ...s.points.map(p => `· ${p}`))
  if (s.todos.length) lines.push('', '待办：', ...s.todos.map(t => `☐ ${t}`))
  if (s.insight) lines.push('', `💡 ${s.insight}`)
  lines.push('', `已存进每日一记；全文只在 Mac：${localPath}`)
  return lines.join('\n')
}

export function markdownFile({ day, hhmm, duration, source, stats }, s, transcript, thai) {
  const out = [`# ${s.title}`, '', `- 时间：${day} ${hhmm}（曼谷）`, `- 时长：${fmtDuration(duration)}`, `- 类型：${s.kind}`]
  if (stats) out.push(`- 说话时长：中文 ${fmtDuration(stats.zh)} · 泰语 ${fmtDuration(stats.th)} · 英语 ${fmtDuration(stats.en)}`)
  out.push(`- 原始录音：${source}`, '')
  if (s.summary) out.push('## 摘要', '', s.summary, '')
  if (s.points.length) out.push('## 要点', '', ...s.points.map(p => `- ${p}`), '')
  if (s.todos.length) out.push('## 待办', '', ...s.todos.map(t => `- [ ] ${t}`), '')
  if (s.insight) out.push('## 启示', '', s.insight, '')
  if (thai && (thai.phrases.length || thai.wish.length)) {
    out.push('## 生活泰语', '')
    if (thai.note) out.push(thai.note, '')
    for (const p of thai.phrases) out.push(`- **${p.roman}** —— ${p.zh}（${[p.time, p.scene, p.who].filter(Boolean).join(' · ')}）  `, `  ${p.thai}`)
    for (const w of thai.wish) out.push(`- 想说「${w.said || w.zh}」→ **${w.roman}**（${w.zh}）  `, `  ${w.thai}`)
    out.push('')
  }
  out.push('## 转写全文', '', transcript || '（没有识别到说话）', '')
  return out.join('\n')
}

// 文件名里不能有的字符换掉，标题太长截断
export const safeName = s => oneLine(s).replace(/[/\\:*?"<>|]/g, '·').slice(0, 30) || '录音'

// 写一个 16kHz 单声道 16 位的 wav 文件头
export function wavHeader(dataBytes, rate = 16000) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(dataBytes, 40)
  return h
}
