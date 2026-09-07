import test from 'node:test'
import assert from 'node:assert/strict'
import { nextTodos, activeProjects, replaceDigestBlock } from './controlCenter.js'

test('overdue actions precede future actions and completed items stay out', () => {
  const rows = [
    { id: 'future', priority: 'high', due_date: '2026-09-10' },
    { id: 'done', status: 'done', due_date: '2026-09-01' },
    { id: 'overdue', priority: 'low', due_date: '2026-09-01' },
    { id: 'today', priority: 'high', due_date: '2026-09-07' },
  ]
  assert.deepEqual(nextTodos(rows, '2026-09-07').map(x => x.id), ['today', 'overdue', 'future'])
  assert.equal(rows.length, 4)
})

test('project list excludes paused and completed projects', () => {
  assert.deepEqual(activeProjects([
    { title: 'paused', status: 'paused' },
    { title: 'active', status: 'active' },
    { title: 'done', status: 'done' },
  ]).map(x => x.title), ['active'])
})

test('repeated synchronization preserves another project and manual notes', () => {
  let text = replaceDigestBlock('手写记录', '工作', '工作进展')
  text = replaceDigestBlock(text, '学习', '学习进展')
  text += '\n\n手动补充'
  const updated = replaceDigestBlock(text, '工作', '新的工作进展')
  assert.match(updated, /学习进展/)
  assert.match(updated, /手写记录/)
  assert.match(updated, /手动补充/)
  assert.equal(replaceDigestBlock(updated, '工作', '新的工作进展'), updated)
  assert.equal(updated.match(/工作 · 自动同步/g).length, 1)
})

test('legacy block replacement stops before the next project', () => {
  const original = '手写\n\n—— 工作 · 自动同步 ——\n旧内容\n\n—— 学习 · 自动同步 ——\n保留'
  const updated = replaceDigestBlock(original, '工作', '新内容')
  assert.match(updated, /学习 · 自动同步 ——\n保留/)
  assert.doesNotMatch(updated, /旧内容/)
})
