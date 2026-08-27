import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  allocateSourceKey,
  contentHash,
  parseIdea,
  parseTimeline,
  renderIdea,
  resolveInside,
  toDatabasePattern,
  validateImageDownloadUrl,
  readResponseBodyLimited,
} from './trade-patterns-core.mjs'
import { syncPullRecord, syncPushRecord } from './trade-patterns-sync.mjs'

const IDEA_MD = `---
id: 007
title: 强势币见顶后的弱反弹横盘续跌
type: strategy
status: 灵感收藏
origin_date: 2026-08-27
tags: [强势币, 5分钟, 做空]
---

## 用户原话（2026-08-27）

> 用户原话，不修改

## 图中可见事实

- 首次下跌后反弹偏弱。

## 待验证形态假设

1. 反弹不过中位。

## 待定项

- 中位锚点待定。

## 原始截图

![图](assets/original.jpg)
`

test('parseIdea preserves quote and separates research layers', () => {
  const parsed = parseIdea(IDEA_MD, '007-demo')
  assert.equal(parsed.title, '强势币见顶后的弱反弹横盘续跌')
  assert.equal(parsed.original_quote, '用户原话，不修改')
  assert.match(parsed.observations, /首次下跌后反弹偏弱/)
  assert.match(parsed.hypotheses, /反弹不过中位/)
  assert.match(parsed.pending_questions, /中位锚点待定/)
  assert.equal(parsed.image_path, 'assets/original.jpg')
  assert.deepEqual(parsed.tags, ['强势币', '5分钟', '做空'])
})

test('parseIdea supports historical heading aliases', () => {
  const parsed = parseIdea(`---\ntitle: 老案例\norigin_chart: charts/original.png\norigin_symbol: EDGEUSDT\norigin_tf: 5m\n---\n## 出发点（用户原话，2026-07-12）\n> 老原话\n## 这张图发生了什么\n事实\n## 假设（要验证的东西）\n假设\n## 仍待明确\n边界`, '001-old')
  assert.equal(parsed.original_quote, '老原话')
  assert.equal(parsed.observations, '事实')
  assert.equal(parsed.hypotheses, '假设')
  assert.equal(parsed.pending_questions, '边界')
  assert.equal(parsed.image_path, 'charts/original.png')
  assert.equal(parsed.symbol, 'EDGEUSDT')
  assert.equal(parsed.timeframe, '5m')
})

test('parseIdea keeps multiple raw-word sections and newer rule aliases', () => {
  const parsed = parseIdea(`---\ntitle: 复盘\n---\n## 用户原话（2026-08-27）\n> 第一段\n## 操作思路原话（2026-08-27）\n> 第二段\n## 已确认口径\n确认规则\n## 研究问题\n待验证边界`, '006-review')
  assert.equal(parsed.original_quote, '第一段\n\n第二段')
  assert.equal(parsed.hypotheses, '确认规则')
  assert.equal(parsed.pending_questions, '待验证边界')
})

test('parseTimeline returns dated updates newest first', () => {
  const rows = parseTimeline('# 时间线\n\n## 2026-08-27 · 收藏\n\n- 第一条\n\n## 2026-08-26 13:31 · 实盘结局\n\n内容')
  assert.deepEqual(rows.map(row => row.title), ['收藏', '13:31 · 实盘结局'])
  assert.equal(rows[0].event_date, '2026-08-27')
  assert.match(rows[0].content, /第一条/)
})

test('allocateSourceKey uses maximum numeric prefix plus one', () => {
  assert.equal(allocateSourceKey(['001-a', '007-b'], '弱反弹续跌'), '008-idea')
})

test('resolveInside rejects traversal outside archive root', () => {
  const root = join('C:', 'trade', 'research', 'ideas')
  assert.throws(() => resolveInside(root, '..\\outside'), /越界/)
  assert.match(resolveInside(root, '008-idea'), /008-idea$/)
})

test('renderIdea preserves exact original quote and does not turn it into a rule', () => {
  const markdown = renderIdea({
    id: '008', title: '测试形态', origin_date: '2026-08-27', tags: ['测试'],
    original_quote: '  原话保留前后空格  ', observations: '事实', hypotheses: '假设',
    pending_questions: '边界', image_filename: 'original.jpg',
  })
  assert.match(markdown, />   原话保留前后空格  /)
  assert.match(markdown, /## 待验证形态假设[\s\S]*假设/)
})

test('renderIdea safely escapes frontmatter strings and remains parseable', () => {
  const markdown = renderIdea({
    id: '008', life_os_id: 'uuid', title: '标题\nstatus: injected', pattern_type: 'case',
    origin_date: '2026-08-27', tags: ['a, b', 'x]'], original_quote: '原话',
  })
  const parsed = parseIdea(markdown, '008-safe')
  assert.equal(parsed.title, '标题\nstatus: injected')
  assert.deepEqual(parsed.tags, ['a, b', 'x]'])
})

test('contentHash is deterministic and changes with content', () => {
  assert.equal(contentHash('same'), contentHash('same'))
  assert.notEqual(contentHash('same'), contentHash('different'))
})

test('database pattern excludes parser-only and filesystem-only fields', () => {
  const row = toDatabasePattern({
    source_key: '007-demo', title: 'Demo', source_hash: 'hash',
    raw_markdown: 'raw', image_path: 'assets/original.jpg', imageBytes: Buffer.from('x'),
    localImagePath: 'C:/image.jpg', updates: [{ content: 'note' }],
  })
  assert.equal(row.source_key, '007-demo')
  assert.equal(row.source_hash, 'hash')
  assert.equal('raw_markdown' in row, false)
  assert.equal('image_path' in row, false)
  assert.equal('updates' in row, false)
})

test('image writeback only downloads from this project public attachments bucket', () => {
  const project = 'https://demo.supabase.co'
  assert.equal(
    validateImageDownloadUrl('https://demo.supabase.co/storage/v1/object/public/attachments/123.jpg', project).hostname,
    'demo.supabase.co',
  )
  assert.throws(() => validateImageDownloadUrl('http://127.0.0.1/admin', project), /不允许/)
  assert.throws(() => validateImageDownloadUrl('https://example.com/image.jpg', project), /不允许/)
  assert.throws(() => validateImageDownloadUrl('https://demo.supabase.co/storage/v1/object/public/other/a.jpg', project), /不允许/)
})

test('streamed image download aborts before retaining an oversized body', async () => {
  assert.deepEqual(await readResponseBodyLimited(new Response(Buffer.from('1234')), 5), Buffer.from('1234'))
  await assert.rejects(
    () => readResponseBodyLimited(new Response(Buffer.from('123456')), 5),
    /超过 5B/,
  )
})

test('sync pull is idempotent by source key and hash', async () => {
  const saved = new Map()
  const updates = new Set()
  const deps = {
    findPattern: async key => saved.get(key) || null,
    upsertPattern: async row => { saved.set(row.source_key, { id: 'p1', ...row }); return saved.get(row.source_key) },
    upsertUpdate: async row => { updates.add(`${row.pattern_id}:${row.source_hash}`) },
  }
  const source = { source_key: '007-demo', source_hash: 'hash', title: 'Demo', updates: [
    { source_hash: 'u1', title: '收藏', content: '内容' },
  ] }
  assert.deepEqual(await syncPullRecord(deps, source), { status: 'synced', pattern_id: 'p1' })
  assert.deepEqual(await syncPullRecord(deps, source), { status: 'unchanged', pattern_id: 'p1' })
  assert.equal(saved.size, 1)
  assert.equal(updates.size, 1)
})

test('sync pull repairs missing timeline rows even when pattern hash is unchanged', async () => {
  const updates = []
  const result = await syncPullRecord({
    findPattern: async () => ({ id: 'p1', source_hash: 'hash' }),
    upsertPattern: async () => assert.fail('pattern itself is unchanged'),
    upsertUpdate: async row => updates.push(row),
  }, { source_key: '007-demo', source_hash: 'hash', updates: [{ source_hash: 'u1', content: '恢复' }] })
  assert.equal(result.status, 'unchanged')
  assert.equal(updates.length, 1)
})

test('sync push writes one archive and marks draft synced', async () => {
  const patches = []
  const written = []
  const deps = {
    listDirectories: async () => ['001-old', '007-last'],
    downloadImage: async () => ({ bytes: Buffer.from('jpg'), extension: 'jpg' }),
    writeArchive: async value => { written.push(value) },
    patchPattern: async (id, patch) => { patches.push({ id, patch }) },
  }
  const result = await syncPushRecord(deps, {
    id: 'draft', source_key: 'web-draft', sync_state: 'pending_writeback',
    title: '弱反弹续跌', origin_date: '2026-08-27', original_quote: '原话',
    image_url: 'https://example.test/image.jpg', tags: [],
  })
  assert.equal(result.source_key, '008-idea')
  assert.equal(written.length, 1)
  assert.equal(patches.at(-1).patch.sync_state, 'synced')
})

test('sync push failure preserves draft and records error', async () => {
  const patches = []
  const deps = {
    listDirectories: async () => [],
    downloadImage: async () => { throw new Error('图片下载失败') },
    writeArchive: async () => assert.fail('must not write archive'),
    patchPattern: async (id, patch) => { patches.push({ id, patch }) },
  }
  await assert.rejects(() => syncPushRecord(deps, {
    id: 'draft', sync_state: 'pending_writeback', title: '测试',
    origin_date: '2026-08-27', image_url: 'bad', tags: [],
  }), /图片下载失败/)
  assert.equal(patches.at(-1).patch.sync_state, 'sync_error')
  assert.match(patches.at(-1).patch.sync_error, /图片下载失败/)
})

test('sync push recovers an archive written before database acknowledgement', async () => {
  const recovered = []
  const result = await syncPushRecord({
    findWrittenArchive: async draftId => draftId === 'draft' ? '008-recovered' : null,
    recoverPattern: async (id, sourceKey) => recovered.push({ id, sourceKey }),
    patchPattern: async () => assert.fail('special recovery must handle source-key conflicts'),
    listDirectories: async () => assert.fail('must not allocate another archive'),
  }, { id: 'draft', sync_state: 'sync_error', title: '恢复' })
  assert.equal(result.source_key, '008-recovered')
  assert.deepEqual(recovered, [{ id: 'draft', sourceKey: '008-recovered' }])
})
