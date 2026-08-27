import { createHash } from 'node:crypto'
import { resolve, sep } from 'node:path'

const STATUS_MAP = {
  '灵感收藏': 'idea', '立项': 'researching', '研究中': 'researching',
  '已验证': 'validated', '已形成规律': 'validated', '已证伪': 'invalidated',
  '归档': 'archived',
}

function cleanScalar(value = '') {
  const text = String(value).trim()
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text) } catch { /* 兼容旧档案 */ }
  }
  return text.replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '')
}

export function parseFrontMatter(markdown) {
  const match = String(markdown).match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (!match) return { meta: {}, body: String(markdown) }
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!pair) continue
    const [, key, raw] = pair
    if (/^\[.*\]$/.test(raw.trim())) {
      try {
        const parsed = JSON.parse(raw.trim())
        meta[key] = Array.isArray(parsed) ? parsed : []
      } catch {
        meta[key] = raw.trim().slice(1, -1).split(',').map(cleanScalar).filter(Boolean)
      }
    } else {
      meta[key] = cleanScalar(raw)
    }
  }
  return { meta, body: String(markdown).slice(match[0].length) }
}

function splitSections(body) {
  const sections = []
  const re = /^##\s+(.+)\s*$/gm
  let match
  let current = null
  while ((match = re.exec(body))) {
    if (current) current.content = body.slice(current.start, match.index).trim()
    current = { heading: match[1].trim(), start: re.lastIndex, content: '' }
    sections.push(current)
  }
  if (current) current.content = body.slice(current.start).trim()
  return sections
}

export function section(markdown, headings) {
  const { body } = parseFrontMatter(markdown)
  const aliases = headings.map(value => value.toLowerCase())
  const found = splitSections(body).find(item =>
    aliases.some(alias => item.heading.toLowerCase().startsWith(alias)))
  return found?.content || ''
}

function quoteText(value) {
  return String(value).split(/\r?\n/)
    .filter(line => line.trim().startsWith('>'))
    .map(line => line.replace(/^\s*>\s?/, ''))
    .join('\n').trimEnd()
}

function plainSection(value) {
  return String(value).replace(/^\s*[-*]\s+/gm, '- ').trim()
}

export function parseIdea(markdown, sourceKey) {
  const { meta, body } = parseFrontMatter(markdown)
  const originalRaw = [
    section(body, ['用户原话']),
    section(body, ['用户后续澄清']),
    section(body, ['操作思路原话']),
    section(body, ['出发点（用户原话']),
  ].filter(Boolean).map(quoteText).filter(Boolean).join('\n\n')
  const observations = section(body, ['图中可见事实', '这张图发生了什么'])
  const hypotheses = section(body, ['待验证形态假设', '已确认假设', '已确认口径', '假设（要验证的东西）', '定义（'])
  const pending = section(body, ['待定项', '仍待明确', '研究问题'])
  const image = body.match(/!\[[^\]]*\]\(([^)]+)\)/)
  const status = STATUS_MAP[meta.status] || (['idea', 'researching', 'validated', 'invalidated', 'archived'].includes(meta.status) ? meta.status : 'idea')
  return {
    source_key: sourceKey,
    title: meta.title || sourceKey,
    pattern_type: meta.type || 'case',
    status,
    origin_date: meta.origin_date || null,
    symbol: meta.symbol || meta.origin_symbol || null,
    timeframe: meta.timeframe || meta.origin_tf || null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    original_quote: originalRaw,
    observations: plainSection(observations),
    hypotheses: plainSection(hypotheses),
    pending_questions: plainSection(pending),
    image_path: image?.[1] || meta.origin_chart || '',
    raw_markdown: String(markdown),
  }
}

export function parseTimeline(markdown) {
  const rows = []
  for (const item of splitSections(String(markdown))) {
    const match = item.heading.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s*[·・—-]\s*(.+)$/)
    if (!match) continue
    const content = item.content.trim()
    rows.push({
      event_date: match[1], title: `${match[2] ? `${match[2]} · ` : ''}${match[3].trim()}`, content,
      update_type: /证伪/.test(item.heading + content) ? 'invalidation'
        : /回测/.test(item.heading + content) ? 'backtest'
          : /验证|确认/.test(item.heading + content) ? 'validation' : 'note',
      source_hash: contentHash(`${match[1]}\n${match[2] || ''}\n${match[3]}\n${content}`),
    })
  }
  return rows.sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)))
}

export function contentHash(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex')
}

const DATABASE_PATTERN_FIELDS = [
  'source_key', 'source_project', 'title', 'pattern_type', 'status', 'origin_date',
  'direction', 'symbol', 'timeframe', 'tags', 'original_quote', 'observations',
  'hypotheses', 'pending_questions', 'image_url', 'source_path', 'source_hash',
  'sync_state', 'sync_error', 'created_via',
]

export function toDatabasePattern(source) {
  return Object.fromEntries(DATABASE_PATTERN_FIELDS
    .filter(field => Object.hasOwn(source, field))
    .map(field => [field, source[field]]))
}

export function validateImageDownloadUrl(candidate, supabaseUrl) {
  let target
  let project
  try {
    target = new URL(candidate)
    project = new URL(supabaseUrl)
  } catch {
    throw new Error('截图地址不允许：URL 无效')
  }
  const allowedPrefix = '/storage/v1/object/public/attachments/'
  if (target.protocol !== 'https:' || target.origin !== project.origin ||
      target.username || target.password || !target.pathname.startsWith(allowedPrefix)) {
    throw new Error('截图地址不允许：只接受本项目 attachments 公共桶')
  }
  return target
}

export async function readResponseBodyLimited(response, maxBytes) {
  if (!response.body) throw new Error('截图响应没有内容')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new Error(`截图超过 ${maxBytes}B 限制`)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, total)
}

function slugify(title) {
  const ascii = String(title).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  return ascii || 'idea'
}

export function allocateSourceKey(existingNames, title) {
  const highest = existingNames.reduce((max, name) => {
    const match = String(name).match(/^(\d+)-/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `${String(highest + 1).padStart(3, '0')}-${slugify(title)}`
}

export function resolveInside(root, relative) {
  const rootPath = resolve(root)
  const target = resolve(rootPath, relative)
  const prefix = rootPath.endsWith(sep) ? rootPath : rootPath + sep
  if (target.toLowerCase() !== rootPath.toLowerCase() &&
      !target.toLowerCase().startsWith(prefix.toLowerCase())) {
    throw new Error(`目标路径越界：${relative}`)
  }
  return target
}

function blockquote(value) {
  return String(value ?? '').split(/\r?\n/).map(line => `> ${line}`).join('\n')
}

export function renderIdea(record) {
  const image = record.image_filename
    ? `\n## 原始截图\n\n![原始形态](assets/${record.image_filename})\n` : ''
  return `---
id: ${record.id}
life_os_id: ${JSON.stringify(record.life_os_id || '')}
title: ${JSON.stringify(record.title)}
type: ${JSON.stringify(record.pattern_type || 'case')}
status: 灵感收藏
origin_date: ${record.origin_date}
tags: ${JSON.stringify(Array.isArray(record.tags) ? record.tags : [])}
---

## 用户原话（${record.origin_date}）

${blockquote(record.original_quote)}
${image}
## 图中可见事实

${record.observations || '待补充'}

## 待验证形态假设

${record.hypotheses || '待补充'}

## 待定项

${record.pending_questions || '待补充'}

## 当前边界

- 本记录由人生 OS 写回交易研究档案。
- 暂不写入线上策略，不触发自动下单。

## 研究链路

见 [timeline.md](timeline.md)。
`
}

export function renderTimeline(record) {
  return `# 研究链路 · ${record.id} ${record.title}

> 每次新增案例、规则澄清、回测或证伪都在最上方追加。

---

## ${record.origin_date} · 从人生 OS 收藏首个案例

- 保存用户原话与原始截图。
- 本次没有修改策略代码、线上监控或自动下单规则。
`
}
