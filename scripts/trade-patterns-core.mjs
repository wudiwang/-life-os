import { createHash } from 'node:crypto'
import { resolve, sep } from 'node:path'

const STATUS_MAP = {
  '灵感收藏': 'idea', '立项': 'researching', '研究中': 'researching',
  '已验证': 'validated', '已形成规律': 'validated', '已证伪': 'invalidated',
  '归档': 'archived',
}

function cleanScalar(value = '') {
  return String(value).trim().replace(/^['"]|['"]$/g, '')
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
      meta[key] = raw.trim().slice(1, -1).split(',').map(cleanScalar).filter(Boolean)
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
  const originalRaw = section(body, ['用户原话', '操作思路原话', '出发点（用户原话'])
  const observations = section(body, ['图中可见事实', '这张图发生了什么'])
  const hypotheses = section(body, ['待验证形态假设', '已确认假设', '假设（要验证的东西）', '定义（'])
  const pending = section(body, ['待定项', '仍待明确'])
  const image = body.match(/!\[[^\]]*\]\(([^)]+)\)/)
  const status = STATUS_MAP[meta.status] || (['idea', 'researching', 'validated', 'invalidated', 'archived'].includes(meta.status) ? meta.status : 'idea')
  return {
    source_key: sourceKey,
    title: meta.title || sourceKey,
    pattern_type: meta.type || 'case',
    status,
    origin_date: meta.origin_date || null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    original_quote: quoteText(originalRaw),
    observations: plainSection(observations),
    hypotheses: plainSection(hypotheses),
    pending_questions: plainSection(pending),
    image_path: image?.[1] || '',
    raw_markdown: String(markdown),
  }
}

export function parseTimeline(markdown) {
  const rows = []
  for (const item of splitSections(String(markdown))) {
    const match = item.heading.match(/^(\d{4}-\d{2}-\d{2})\s*[·・—-]\s*(.+)$/)
    if (!match) continue
    const content = item.content.trim()
    rows.push({
      event_date: match[1], title: match[2].trim(), content,
      update_type: /证伪/.test(item.heading + content) ? 'invalidation'
        : /回测/.test(item.heading + content) ? 'backtest'
          : /验证|确认/.test(item.heading + content) ? 'validation' : 'note',
      source_hash: contentHash(`${match[1]}\n${match[2]}\n${content}`),
    })
  }
  return rows.sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)))
}

export function contentHash(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex')
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
  const tags = Array.isArray(record.tags) ? record.tags.join(', ') : ''
  const image = record.image_filename
    ? `\n## 原始截图\n\n![原始形态](assets/${record.image_filename})\n` : ''
  return `---
id: ${record.id}
title: ${record.title}
type: ${record.pattern_type || 'case'}
status: 灵感收藏
origin_date: ${record.origin_date}
tags: [${tags}]
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
