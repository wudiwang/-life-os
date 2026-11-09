// 手表录音整理的纯函数：认录音时间、清洗转写、拼提示词、解析 AI 结果、生成日记行 / TG 消息 / 本机全文。
// 不碰文件和网络，测试见 voice-memos-core.test.mjs。流程和用法见 voice-memos.mjs。

export const AUDIO_EXT = /\.(m4a|qta|caf|wav|mp3|aac)$/i
export const MIN_SECONDS = 2 // 短于 2 秒的多半是误触

const pad = n => String(n).padStart(2, '0')

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
  const d = new Date(date.getTime() + 7 * 3600 * 1000)
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

const stamp = ms => {
  const s = Math.floor(ms / 1000)
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

// whisper 在安静处常「脑补」视频网站的片尾语，整句命中就丢掉
const HALLUCINATION = /点赞|订阅|打赏|明镜|Amara|字幕|感谢观看|谢谢观看|谢谢收看|谢谢大家收看|优优独播|YoYo/i

// whisper -oj 的 transcription 段 → 干净的 [{ms, text}]：去掉脑补句，连着重复的同一句只留一次
export function cleanSegments(segments) {
  const out = []
  for (const s of segments || []) {
    const text = String(s.text || '').trim()
    if (!text || HALLUCINATION.test(text)) continue
    if (out.length && out[out.length - 1].text === text) continue
    out.push({ ms: Number(s.offsets?.from) || 0, text })
  }
  return out
}

export const transcriptText = segs => segs.map(s => `[${stamp(s.ms)}] ${s.text}`).join('\n')

const MAX_PROMPT_CHARS = 80000

export function buildSummaryPrompt(transcript, { hhmm, duration }) {
  let body = transcript
  if (body.length > MAX_PROMPT_CHARS) {
    const half = MAX_PROMPT_CHARS / 2
    body = `${body.slice(0, half)}\n……（中间太长，省略 ${body.length - MAX_PROMPT_CHARS} 字）……\n${body.slice(-half)}`
  }
  return `下面是我用 Apple Watch 录的一段音（${hhmm} 开始，时长 ${fmtDuration(duration)}），经本机语音识别转成的文字。
可能是我和别人的对话、会议，也可能是我自言自语。没有标注谁在说话，「我」= 录音的人。
语音识别会有同音错字（比如把「仓位」写成「舱位」、「吃」写成「吹」），请按上下文理解，但不要编造没说过的内容。

请整理成 JSON（只输出 JSON，不要其他文字）：
{
  "title": "不超过 15 个字的标题",
  "kind": "对话 / 会议 / 自言自语 / 课堂 / 其他 选一个",
  "summary": "2-3 句话说清楚讲了什么、结论是什么，用第一人称",
  "points": ["要点，最多 6 条，每条一句话"],
  "todos": ["明确要去做的事，没有就空数组，最多 5 条"],
  "insight": "这段录音里值得记住的一句启示，没有就 null"
}

规则：
- 全部简体中文。
- 不要写进密码、密钥、验证码、账号、证件号、银行卡号这类敏感信息（整理结果会存到网上的日记里）。
- 如果全是噪音、听不出在说什么，title 写「没有有效内容」，其他字段留空。

转写原文：
${body}`
}

const strList = (v, max) => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, max)

export function parseSummary(text) {
  let body = String(text || '').trim()
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) body = fenced[1].trim()
  const a = body.indexOf('{'), b = body.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('AI 没有返回 JSON')
  const j = JSON.parse(body.slice(a, b + 1))
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
  const plain = transcript.replace(/^\[[\d:]+\]\s*/gm, '').replace(/\s+/g, ' ').trim()
  return { title: '录音（AI 未整理）', kind: '其他', summary: plain.slice(0, 120) + (plain.length > 120 ? '……' : ''), points: [], todos: [], insight: null }
}

const oneLine = s => String(s || '').replace(/\s+/g, ' ').trim()
const circled = i => '①②③④⑤⑥⑦⑧⑨⑩'[i] || `${i + 1}.`

// 每日一记的 content 一行一条（[HH:MM] 开头），所以整段录音压成一行
export function journalLine({ hhmm, duration }, s) {
  const parts = [`[${hhmm}] 🎙️ 录音 ${fmtDuration(duration)} · ${oneLine(s.title)}`]
  if (s.summary) parts.push(oneLine(s.summary))
  if (s.points.length) parts.push(`要点：${s.points.map((p, i) => circled(i) + oneLine(p)).join(' ')}`)
  if (s.todos.length) parts.push(`待办：${s.todos.map(oneLine).join('；')}`)
  if (s.insight) parts.push(`启示：${oneLine(s.insight)}`)
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

export function markdownFile({ day, hhmm, duration, source, language }, s, transcript) {
  const out = [`# ${s.title}`, '', `- 时间：${day} ${hhmm}（曼谷）`, `- 时长：${fmtDuration(duration)}`, `- 类型：${s.kind}`, `- 语种：${language || '未知'}`, `- 原始录音：${source}`, '']
  if (s.summary) out.push('## 摘要', '', s.summary, '')
  if (s.points.length) out.push('## 要点', '', ...s.points.map(p => `- ${p}`), '')
  if (s.todos.length) out.push('## 待办', '', ...s.todos.map(t => `- [ ] ${t}`), '')
  if (s.insight) out.push('## 启示', '', s.insight, '')
  out.push('## 转写全文', '', transcript || '（没有识别到说话）', '')
  return out.join('\n')
}

// 文件名里不能有的字符换掉，标题太长截断
export const safeName = s => oneLine(s).replace(/[/\\:*?"<>|]/g, '·').slice(0, 30) || '录音'
