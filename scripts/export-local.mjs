// 把云端（Supabase）全部数据导出到本机一个文件夹：原始 JSON 全量备份 + 能直接读的 Markdown。
// 用法：
//   npm run export                         默认导出到项目旁边的 ../life-os-data
//   npm run export -- --out D:\备份\life-os  指定目录
// 读 .env 里的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（与 scripts/db.mjs 相同），只读不写云端。
// 每次运行是一次完整快照：导出目录里由本脚本生成的内容会被整体替换；目录里有别的文件时拒绝写入。

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ALL_TABLES } from '../src/lib/constants.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MARKER = '.life-os-export'
const PAGE = 1000
const GENERATED = ['json', '每日一记', '第二大脑', '启示.md', 'README.md', MARKER]

export function readEnv(file = join(ROOT, '.env')) {
  const env = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

// 拉一张表的全部行。表不存在（迁移未执行）返回 null；没有 id 列时退回不排序分页。
export async function fetchTable(base, key, table, fetchImpl = fetch) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  let order = '&order=id.asc'
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const resp = await fetchImpl(`${base}/rest/v1/${table}?select=*${order}&limit=${PAGE}&offset=${offset}`, { headers })
    const text = await resp.text()
    if (!resp.ok) {
      if (resp.status === 404 || /PGRST205|42P01/.test(text)) return null
      if (order && offset === 0 && /42703|PGRST100|column/.test(text)) { order = ''; offset = -PAGE; continue }
      throw new Error(`${table}: HTTP ${resp.status} ${text.slice(0, 200)}`)
    }
    const page = JSON.parse(text)
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

const bj = iso => iso ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(/\//g, '-') : ''

// Windows 文件名安全
export function safeName(name, fallback = '未命名') {
  const s = String(name || '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80)
  return s || fallback
}

export function journalByMonth(rows) {
  const months = new Map()
  const sorted = [...rows].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)) || String(a.created_at).localeCompare(String(b.created_at)))
  for (const r of sorted) {
    const month = String(r.entry_date || '未标日期').slice(0, 7)
    const lines = months.get(month) || [`# 每日一记 · ${month}`, '']
    lines.push(`## ${r.entry_date || '未标日期'}${r.mood ? ` · 心情 ${'★'.repeat(r.mood)}` : ''}`, '')
    const body = r.content || r.raw_input
    if (body) lines.push(body.trim(), '')
    if (r.gratitude) lines.push(`> 感恩：${r.gratitude.trim()}`, '')
    lines.push(`<sub>记录于 ${bj(r.created_at)}</sub>`, '')
    months.set(month, lines)
  }
  return [...months].map(([month, lines]) => ({ file: `${safeName(month)}.md`, text: lines.join('\n') }))
}

export function knowledgeFiles(rows) {
  const used = new Set()
  return rows.map(r => {
    const dir = safeName(r.category, '未分类')
    let base = safeName(r.title)
    for (let n = 2; used.has(`${dir}/${base}`); n++) base = `${safeName(r.title)} (${n})`
    used.add(`${dir}/${base}`)
    const meta = [r.tags && `标签：${r.tags}`, r.source && `来源：${r.source}`, r.file_url && `附件：${r.file_url}`, `更新：${bj(r.updated_at || r.created_at)}`].filter(Boolean)
    return { dir, file: `${base}.md`, text: [`# ${r.title || '未命名'}`, '', ...meta.map(m => `- ${m}`), '', r.content || ''].join('\n') }
  })
}

export function insightsMarkdown(rows) {
  const sorted = [...rows].sort((a, b) => (b.active - a.active) || (b.hits || 0) - (a.hits || 0))
  return ['# 启示', '', ...sorted.flatMap(r => [
    `## ${r.title}${r.active === false ? '（已停用）' : ''}`,
    '',
    ...(r.detail ? [r.detail.trim(), ''] : []),
    `- 提到 ${r.hits || 1} 次${r.track ? ` · ${r.track}` : ''}${r.source_date ? ` · ${r.source_date}` : ''}`,
    ...(r.source_quote ? [`- 原话：${r.source_quote}`] : []),
    '',
  ])].join('\n')
}

// 目录要么不存在/为空，要么是本脚本以前导出的（有 MARKER）；否则拒绝，避免误删用户文件
export function prepareOutDir(out) {
  if (existsSync(out)) {
    const entries = readdirSync(out)
    if (entries.length && !entries.includes(MARKER)) throw new Error(`${out} 里已有其他文件，换个空目录：npm run export -- --out <目录>`)
    for (const name of GENERATED) rmSync(join(out, name), { recursive: true, force: true })
  }
  mkdirSync(join(out, 'json'), { recursive: true })
  writeFileSync(join(out, MARKER), 'life-os export\n')
}

export async function exportAll({ base, key, out, tables = ALL_TABLES, fetchImpl = fetch, log = console.log }) {
  prepareOutDir(out)
  const counts = []
  const data = {}
  for (const table of tables) {
    const rows = await fetchTable(base, key, table, fetchImpl)
    if (rows === null) { counts.push([table, '表不存在（迁移未执行）']); continue }
    data[table] = rows
    writeFileSync(join(out, 'json', `${table}.json`), JSON.stringify(rows, null, 2))
    counts.push([table, rows.length])
    log(`  ${table.padEnd(24)} ${rows.length}`)
  }

  if (data.journal_entries?.length) {
    mkdirSync(join(out, '每日一记'), { recursive: true })
    for (const f of journalByMonth(data.journal_entries)) writeFileSync(join(out, '每日一记', f.file), f.text)
  }
  if (data.knowledge_notes?.length) {
    for (const f of knowledgeFiles(data.knowledge_notes)) {
      mkdirSync(join(out, '第二大脑', f.dir), { recursive: true })
      writeFileSync(join(out, '第二大脑', f.dir, f.file), f.text)
    }
  }
  if (data.insights?.length) writeFileSync(join(out, '启示.md'), insightsMarkdown(data.insights))

  const total = counts.reduce((n, [, c]) => n + (typeof c === 'number' ? c : 0), 0)
  writeFileSync(join(out, 'README.md'), [
    '# 人生 OS 本地导出', '',
    `导出时间：${bj(new Date().toISOString())}（北京时间） · 共 ${total} 条`, '',
    '- `json/`：每张表的完整原始数据（全量备份，可用于恢复）',
    '- `每日一记/`：按月整理的日记', '- `第二大脑/`：每条知识笔记一个 Markdown 文件，按分类分文件夹', '- `启示.md`：沉淀下来的启示', '',
    '附件（照片、PDF）仍在云端，笔记里保留了链接。', '',
    '| 表 | 条数 |', '|---|---|', ...counts.map(([t, c]) => `| ${t} | ${c} |`), '',
  ].join('\n'))
  return { total, counts }
}

async function main() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--out')
  const out = resolve(i >= 0 && args[i + 1] ? args[i + 1] : join(ROOT, '..', 'life-os-data'))
  if (!existsSync(join(ROOT, '.env'))) throw new Error('找不到 .env（需要 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）')
  const env = readEnv()
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error('.env 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY')
  console.log(`导出到 ${out}`)
  const { total } = await exportAll({ base: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY, out })
  console.log(`✅ 完成，共 ${total} 条。打开 ${join(out, 'README.md')} 查看目录`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1) })
}
