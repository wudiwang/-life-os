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
} from './trade-patterns-core.mjs'

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
  const parsed = parseIdea(`---\ntitle: 老案例\n---\n## 出发点（用户原话，2026-07-12）\n> 老原话\n## 这张图发生了什么\n事实\n## 假设（要验证的东西）\n假设\n## 仍待明确\n边界`, '001-old')
  assert.equal(parsed.original_quote, '老原话')
  assert.equal(parsed.observations, '事实')
  assert.equal(parsed.hypotheses, '假设')
  assert.equal(parsed.pending_questions, '边界')
})

test('parseTimeline returns dated updates newest first', () => {
  const rows = parseTimeline('# 时间线\n\n## 2026-08-27 · 收藏\n\n- 第一条\n\n## 2026-08-26 · 观察\n\n内容')
  assert.deepEqual(rows.map(row => row.title), ['收藏', '观察'])
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

test('contentHash is deterministic and changes with content', () => {
  assert.equal(contentHash('same'), contentHash('same'))
  assert.notEqual(contentHash('same'), contentHash('different'))
})
