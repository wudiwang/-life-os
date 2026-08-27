import test from 'node:test'
import assert from 'node:assert/strict'

import {
  excerpt, filterPatterns, normalizeDraft, syncLabel,
} from './tradePatternUtils.js'

const patterns = [
  { id: '1', title: '弱反弹续跌', status: 'idea', original_quote: '五分钟反弹不过中位', hypotheses: '弱势确立', tags: ['做空'] },
  { id: '2', title: '扫流动性反转', status: 'validated', original_quote: '进入 FVG', hypotheses: '底分型介入', tags: ['FVG'] },
]

test('filterPatterns searches title, quote, hypotheses and tags', () => {
  assert.deepEqual(filterPatterns(patterns, { query: '中位' }).map(row => row.id), ['1'])
  assert.deepEqual(filterPatterns(patterns, { query: 'FVG' }).map(row => row.id), ['2'])
  assert.deepEqual(filterPatterns(patterns, { query: '底分型' }).map(row => row.id), ['2'])
})

test('filterPatterns combines status with search', () => {
  assert.deepEqual(filterPatterns(patterns, { query: '反', status: 'validated' }).map(row => row.id), ['2'])
})

test('normalizeDraft preserves raw quote spacing and creates a pending record', () => {
  const draft = normalizeDraft({ title: '  新形态 ', original_quote: '  用户原话  ', tags: '做空, 5分钟' }, 'web-id', '2026-08-27')
  assert.equal(draft.title, '新形态')
  assert.equal(draft.original_quote, '  用户原话  ')
  assert.deepEqual(draft.tags, ['做空', '5分钟'])
  assert.equal(draft.source_key, 'web-web-id')
  assert.equal(draft.sync_state, 'pending_writeback')
})

test('sync label makes pending and error states explicit', () => {
  assert.equal(syncLabel('synced'), '已归档到交易项目')
  assert.equal(syncLabel('pending_writeback'), '等待本地写回')
  assert.equal(syncLabel('sync_error'), '同步失败')
})

test('excerpt truncates long text without altering short text', () => {
  assert.equal(excerpt('abc', 5), 'abc')
  assert.equal(excerpt('abcdef', 5), 'abcd…')
})
