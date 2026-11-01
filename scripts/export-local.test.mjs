import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportAll, safeName } from './export-local.mjs'

// 假 PostgREST：journal_entries 2500 行（需分页）、knowledge_notes 无 id 排序、missing 表不存在
function fakeFetch(db) {
  return async url => {
    const u = new URL(url)
    const table = u.pathname.split('/').pop()
    if (!(table in db)) return { ok: false, status: 404, text: async () => '{"code":"PGRST205"}' }
    const { rows, noId } = db[table]
    if (noId && u.searchParams.get('order')) return { ok: false, status: 400, text: async () => '{"code":"42703","message":"column id does not exist"}' }
    const offset = Number(u.searchParams.get('offset')), limit = Number(u.searchParams.get('limit'))
    return { ok: true, status: 200, text: async () => JSON.stringify(rows.slice(offset, offset + limit)) }
  }
}

const journal = Array.from({ length: 2500 }, (_, i) => ({ id: i, entry_date: i < 1250 ? '2026-09-15' : '2026-10-02', mood: 3, content: `第 ${i} 条`, created_at: '2026-10-02T01:00:00Z' }))
const db = {
  journal_entries: { rows: journal },
  knowledge_notes: { noId: true, rows: [{ title: 'a/b:c?', category: '生活', content: '正文', created_at: '2026-10-01T00:00:00Z' }, { title: 'a/b:c?', category: '生活', content: '重名', created_at: '2026-10-01T00:00:00Z' }] },
  insights: { rows: [{ id: 1, title: '先做最小闭环', hits: 3, active: true }] },
}

test('exports every table with paging, skips missing tables, and writes readable files', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'lo-')), 'data')
  const { total, counts } = await exportAll({ base: 'http://x', key: 'k', out, tables: ['journal_entries', 'knowledge_notes', 'insights', 'missing'], fetchImpl: fakeFetch(db), log: () => {} })
  assert.equal(total, 2503)
  assert.deepEqual(counts.find(c => c[0] === 'missing'), ['missing', '表不存在（迁移未执行）'])
  assert.equal(JSON.parse(readFileSync(join(out, 'json', 'journal_entries.json'), 'utf8')).length, 2500)
  assert.deepEqual(readdirSync(join(out, '每日一记')).sort(), ['2026-09.md', '2026-10.md'])
  assert.deepEqual(readdirSync(join(out, '第二大脑', '生活')).sort(), ['a b c (2).md', 'a b c.md'])
  assert.match(readFileSync(join(out, '启示.md'), 'utf8'), /先做最小闭环/)
  assert.match(readFileSync(join(out, 'README.md'), 'utf8'), /共 2503 条/)

  // 再导一次：快照覆盖，不残留
  await exportAll({ base: 'http://x', key: 'k', out, tables: ['insights'], fetchImpl: fakeFetch(db), log: () => {} })
  assert.ok(!existsSync(join(out, '每日一记')))
})

test('refuses to write into a folder that holds other files', async () => {
  const out = mkdtempSync(join(tmpdir(), 'lo-'))
  writeFileSync(join(out, '我的文件.txt'), 'x')
  await assert.rejects(exportAll({ base: 'http://x', key: 'k', out, tables: [], fetchImpl: fakeFetch(db), log: () => {} }), /已有其他文件/)
  assert.ok(existsSync(join(out, '我的文件.txt')))
})

test('file names are safe on Windows', () => {
  assert.equal(safeName('a<b>:c"d/e\\f|g?h*'), 'a b c d e f g h')
  assert.equal(safeName('   '), '未命名')
  assert.equal(safeName('结尾点.'), '结尾点')
})
