import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import {
  access, mkdir, readFile, readdir, rename, writeFile,
} from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  contentHash, parseIdea, parseTimeline, renderIdea, renderTimeline, resolveInside,
} from './trade-patterns-core.mjs'
import { syncPullRecord, syncPushRecord } from './trade-patterns-sync.mjs'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const archiveRoot = process.env.TRADE_IDEAS_ROOT || 'C:\\Users\\ADMIN\\trade\\research\\ideas'

async function loadEnv() {
  const candidates = [join(appRoot, '.env'), join(appRoot, '..', '..', '.env')]
  for (const candidate of candidates) {
    try {
      const text = await readFile(candidate, 'utf8')
      const result = {}
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        if (match) result[match[1]] = match[2].trim()
      }
      return result
    } catch { /* 尝试下一个位置 */ }
  }
  throw new Error('未找到人生管理项目的 .env，无法连接 Supabase')
}

function sha256Buffers(parts) {
  const hash = createHash('sha256')
  for (const part of parts) hash.update(part)
  return hash.digest('hex')
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

function imageExtension(url, contentType = '') {
  const fromType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[contentType.split(';')[0]]
  const fromUrl = extname(new URL(url).pathname).slice(1).toLowerCase()
  const candidate = fromType || fromUrl
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(candidate)) throw new Error('截图格式不受支持')
  return candidate === 'jpeg' ? 'jpg' : candidate
}

async function scanArchive() {
  const entries = await readdir(archiveRoot, { withFileTypes: true })
  const rows = []
  for (const entry of entries.filter(item => item.isDirectory() && /^\d+-/.test(item.name))) {
    const directory = resolveInside(archiveRoot, entry.name)
    const ideaPath = join(directory, 'idea.md')
    if (!await exists(ideaPath)) continue
    const ideaMarkdown = await readFile(ideaPath, 'utf8')
    const parsed = parseIdea(ideaMarkdown, entry.name)
    const timelinePath = join(directory, 'timeline.md')
    const timelineMarkdown = await exists(timelinePath) ? await readFile(timelinePath, 'utf8') : ''
    let imageBytes = Buffer.alloc(0)
    let localImagePath = ''
    if (parsed.image_path) {
      localImagePath = resolveInside(directory, parsed.image_path)
      if (await exists(localImagePath)) imageBytes = await readFile(localImagePath)
    }
    rows.push({
      ...parsed,
      source_project: 'trade',
      source_path: `research/ideas/${entry.name}`,
      source_hash: sha256Buffers([ideaMarkdown, timelineMarkdown, imageBytes]),
      sync_state: 'synced',
      sync_error: null,
      created_via: 'trade_sync',
      updates: parseTimeline(timelineMarkdown),
      localImagePath,
      imageBytes,
    })
  }
  return rows
}

async function main() {
  const flags = new Set(process.argv.slice(2))
  const dry = flags.has('--dry')
  const pullOnly = flags.has('--pull-only')
  const pushOnly = flags.has('--push-only')
  if (pullOnly && pushOnly) throw new Error('--pull-only 与 --push-only 不能同时使用')

  const env = await loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase URL 或 anon key 缺失')
  const supabase = createClient(url, key)
  const summary = { discovered: 0, pulled: 0, unchanged: 0, pushed: 0, failed: 0 }

  if (!pushOnly) {
    const sources = await scanArchive()
    summary.discovered = sources.length
    for (const source of sources) {
      if (dry) continue
      const { localImagePath, imageBytes, updates, ...pattern } = source
      if (localImagePath && imageBytes.length) {
        const extension = extname(localImagePath).slice(1).toLowerCase() || 'jpg'
        const storagePath = `trade-patterns/${source.source_key}/${contentHash(imageBytes.toString('base64'))}.${extension}`
        const upload = await supabase.storage.from('attachments').upload(storagePath, imageBytes, {
          contentType: extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`,
          upsert: true,
        })
        if (upload.error) throw upload.error
        pattern.image_url = supabase.storage.from('attachments').getPublicUrl(storagePath).data.publicUrl
      }
      const result = await syncPullRecord({
        findPattern: async sourceKey => {
          const query = await supabase.from('trade_patterns').select('id,source_hash').eq('source_key', sourceKey).maybeSingle()
          if (query.error) throw query.error
          return query.data
        },
        upsertPattern: async row => {
          const query = await supabase.from('trade_patterns').upsert(row, { onConflict: 'source_key' }).select().single()
          if (query.error) throw query.error
          return query.data
        },
        upsertUpdate: async row => {
          const query = await supabase.from('trade_pattern_updates').upsert(row, { onConflict: 'pattern_id,source_hash' })
          if (query.error) throw query.error
        },
      }, { ...pattern, updates })
      summary[result.status === 'synced' ? 'pulled' : 'unchanged'] += 1
    }
  }

  if (!pullOnly) {
    const query = await supabase.from('trade_patterns').select('*').in('sync_state', ['pending_writeback', 'sync_error']).eq('created_via', 'life_os')
    if (query.error) throw query.error
    for (const draft of query.data || []) {
      if (dry) continue
      try {
        await syncPushRecord({
          listDirectories: async () => (await readdir(archiveRoot, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name),
          downloadImage: async imageUrl => {
            if (!imageUrl) throw new Error('草稿缺少原始截图')
            const response = await fetch(imageUrl)
            if (!response.ok) throw new Error(`截图下载失败：HTTP ${response.status}`)
            const bytes = Buffer.from(await response.arrayBuffer())
            if (!bytes.length) throw new Error('下载到的截图为空')
            return { bytes, extension: imageExtension(imageUrl, response.headers.get('content-type') || '') }
          },
          writeArchive: async ({ sourceKey, record, image }) => {
            const finalDirectory = resolveInside(archiveRoot, sourceKey)
            if (await exists(finalDirectory)) throw new Error(`研究档案已存在：${sourceKey}`)
            const tempName = `.pending-${sourceKey}-${draft.id}`
            const tempDirectory = resolveInside(archiveRoot, tempName)
            await mkdir(join(tempDirectory, 'assets'), { recursive: false })
            await writeFile(join(tempDirectory, 'idea.md'), renderIdea(record), { flag: 'wx' })
            await writeFile(join(tempDirectory, 'timeline.md'), renderTimeline(record), { flag: 'wx' })
            await writeFile(join(tempDirectory, 'assets', record.image_filename), image.bytes, { flag: 'wx' })
            await rename(tempDirectory, finalDirectory)
          },
          patchPattern: async (id, patch) => {
            const update = await supabase.from('trade_patterns').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
            if (update.error) throw update.error
          },
        }, draft)
        summary.pushed += 1
      } catch (error) {
        summary.failed += 1
        console.error(`写回失败 ${draft.id}：${error.message}`)
      }
    }
  }

  console.log(JSON.stringify({ dry_run: dry, ...summary }))
  if (summary.failed) process.exitCode = 1
}

main().catch(error => {
  console.error(`同步失败：${error.message}`)
  process.exitCode = 1
})
