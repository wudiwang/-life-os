# 人生 OS 交易形态库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在人生 OS 上线独立交易形态库，展示交易项目已有 001～007，并让网页新增的截图与原话安全写回交易研究档案。

**Architecture:** Supabase 保存移动端可访问的镜像与待写回状态，交易仓库 `research/ideas` 保持唯一主数据源。本机 Node 同步器负责 Markdown/图片 pull 和网页草稿 push，React 页面只通过现有 `db.*` 与 `uploadFile` 访问数据。

**Tech Stack:** React 19、Vite、Supabase/Postgres、Node 22 built-in test、现有 inline styles、zustand、Vercel。

---

## 文件结构

- Create: `supabase/v10_trade_patterns.sql` — 两张表、约束、索引和 RLS 设置。
- Create: `scripts/trade-patterns-core.mjs` — Markdown 解析、哈希、编号/slug、路径边界与写回文件生成。
- Create: `scripts/trade-patterns-core.test.mjs` — 同步核心的 Node 单元测试。
- Create: `scripts/sync-trade-patterns.mjs` — Supabase/Storage 与交易目录的双向编排。
- Create: `src/pages/TradePatterns/tradePatternUtils.js` — 页面状态映射、筛选和摘要纯函数。
- Create: `src/pages/TradePatterns/TradePatternsPage.jsx` — PC/H5 列表、详情、新增和同步状态。
- Create: `src/pages/TradePatterns/tradePatternUtils.test.mjs` — 页面纯函数测试。
- Modify: `src/pages/registry.js` — 注册页面。
- Modify: `src/lib/constants.js` — 导航项、状态常量和备份表清单。
- Modify: `package.json` — 同步与测试命令。
- Modify: `README.md`、`CLAUDE.md` — 模块与同步说明。

### Task 1: 数据库模型与迁移

**Files:**
- Create: `supabase/v10_trade_patterns.sql`
- Modify: `src/lib/constants.js`

- [ ] **Step 1: 写迁移文件**

创建 UUID 主表和时间线子表；使用 `source_key` 唯一约束和 `(pattern_id, source_hash)` 唯一索引保证幂等：

```sql
create table if not exists trade_patterns (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_project text not null default 'trade',
  title text not null,
  pattern_type text not null default 'case',
  status text not null default 'idea',
  origin_date date,
  direction text not null default 'unknown',
  symbol text, timeframe text,
  tags jsonb not null default '[]'::jsonb,
  original_quote text, observations text, hypotheses text, pending_questions text,
  image_url text, source_path text, source_hash text,
  sync_state text not null default 'pending_writeback',
  sync_error text, created_via text not null default 'life_os',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists trade_pattern_updates (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references trade_patterns(id) on delete cascade,
  event_date date, update_type text not null default 'note',
  title text, content text not null, source_hash text not null,
  created_at timestamptz not null default now(),
  unique(pattern_id, source_hash)
);
alter table trade_patterns disable row level security;
alter table trade_pattern_updates disable row level security;
create index if not exists idx_trade_patterns_status on trade_patterns(status, origin_date desc);
create index if not exists idx_trade_pattern_updates_pattern on trade_pattern_updates(pattern_id, event_date desc);
```

- [ ] **Step 2: 更新备份表清单与状态常量**

在 `ALL_TABLES` 加入 `trade_patterns`、`trade_pattern_updates`；新增 `TRADE_PATTERN_STATUS`，固定映射 `idea/researching/validated/invalidated/archived`。

- [ ] **Step 3: 静态校验并提交**

Run: `npm run build`

Expected: Vite build exit 0。

```powershell
git add -- supabase/v10_trade_patterns.sql src/lib/constants.js
git commit -m "feat(patterns): add trade pattern schema"
```

### Task 2: Markdown 解析与安全写回核心

**Files:**
- Create: `scripts/trade-patterns-core.mjs`
- Create: `scripts/trade-patterns-core.test.mjs`

- [ ] **Step 1: 写失败测试**

使用 `node:test` 覆盖：

```js
test('parseIdea preserves quote and separates hypotheses', () => {
  const parsed = parseIdea(IDEA_MD, '007-demo')
  assert.equal(parsed.original_quote, '用户原话')
  assert.match(parsed.hypotheses, /反弹不过中位/)
})
test('allocateSourceKey uses max numeric prefix plus one', () => {
  assert.equal(allocateSourceKey(['001-a', '007-b'], '弱反弹续跌'), '008-weak-rebound-continuation')
})
test('resolveInside rejects traversal', () => {
  assert.throws(() => resolveInside(ROOT, '..\\outside'), /越界/)
})
test('renderIdea preserves the exact original quote', () => {
  assert.match(renderIdea({ original_quote: '原话，不修改' }), /> 原话，不修改/)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test scripts/trade-patterns-core.test.mjs`

Expected: FAIL because module/functions do not exist。

- [ ] **Step 3: 实现最小核心**

导出固定接口：

```js
export function parseFrontMatter(markdown) {}
export function section(markdown, headings) {}
export function parseIdea(markdown, sourceKey) {}
export function parseTimeline(markdown) {}
export function contentHash(value) {}
export function allocateSourceKey(existingNames, title) {}
export function resolveInside(root, relative) {}
export function renderIdea(record) {}
export function renderTimeline(record) {}
```

解析只识别已知标题；未知内容放入 `observations` 尾部的“未分类原文”，不得丢弃。`resolveInside` 必须比较 `resolve(root)` 与 `resolve(root, relative)`，拒绝不在根目录内的目标。

- [ ] **Step 4: 运行测试并提交**

Run: `node --test scripts/trade-patterns-core.test.mjs`

Expected: all tests pass。

```powershell
git add -- scripts/trade-patterns-core.mjs scripts/trade-patterns-core.test.mjs
git commit -m "feat(patterns): parse and write trade idea archives"
```

### Task 3: Supabase 双向同步器

**Files:**
- Create: `scripts/sync-trade-patterns.mjs`
- Modify: `package.json`
- Modify: `scripts/trade-patterns-core.test.mjs`

- [ ] **Step 1: 增加幂等与写回失败测试**

通过注入 fake repository 验证：相同 `source_hash` 不重复 upsert；`pending_writeback` 成功后变 `synced`；图片下载失败时保留草稿并写 `sync_error`。

```js
test('sync pull is idempotent by source key and hash', async () => {
  const result = await syncPull(fakeDeps, [fixtureIdea])
  assert.equal(result.inserted, 1)
  assert.equal((await syncPull(fakeDeps, [fixtureIdea])).unchanged, 1)
})
test('push failure never deletes pending draft', async () => {
  await assert.rejects(() => syncPush(failingDeps, draft))
  assert.equal(failingDeps.removed.length, 0)
  assert.match(failingDeps.patches[0].sync_error, /图片/)
})
```

- [ ] **Step 2: 实现 CLI 编排**

同步器运行顺序固定：读取运行环境 → 校验 Supabase 配置存在但不输出值 → pull 交易目录 → push pending 草稿。参数：`--dry`、`--pull-only`、`--push-only`。

历史图片上传路径固定为 `trade-patterns/<source_key>/<sha256>.<ext>`；已有对象冲突视为成功。写回交易目录时先创建临时目录，全部文件完成后再原子重命名为最终编号目录。

- [ ] **Step 3: 添加命令**

```json
{
  "scripts": {
    "sync:patterns": "node scripts/sync-trade-patterns.mjs",
    "test:patterns": "node --test scripts/trade-patterns-core.test.mjs src/pages/TradePatterns/tradePatternUtils.test.mjs"
  }
}
```

- [ ] **Step 4: 测试并提交**

Run: `npm run test:patterns`

Expected: all Node tests pass。

```powershell
git add -- scripts/sync-trade-patterns.mjs scripts/trade-patterns-core.test.mjs package.json
git commit -m "feat(patterns): sync life OS with trade archives"
```

### Task 4: 页面纯函数与状态呈现

**Files:**
- Create: `src/pages/TradePatterns/tradePatternUtils.js`
- Create: `src/pages/TradePatterns/tradePatternUtils.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
test('filterPatterns searches quote and hypotheses', () => {
  assert.equal(filterPatterns(rows, { query: '中位', status: 'all' }).length, 1)
})
test('syncLabel never presents pending as synced', () => {
  assert.equal(syncLabel('pending_writeback').label, '等待写回交易档案')
})
test('normalizeDraft preserves raw quote', () => {
  assert.equal(normalizeDraft({ original_quote: '  原话  ' }).original_quote, '  原话  ')
})
```

- [ ] **Step 2: 实现纯函数**

```js
export function filterPatterns(rows, { query, status, direction }) {}
export function syncLabel(state) {}
export function excerpt(text, length = 100) {}
export function normalizeDraft(draft) {}
```

搜索使用小写字符串包含；`normalizeDraft` 只 trim 标题/标签，不 trim `original_quote`。

- [ ] **Step 3: 测试并提交**

Run: `node --test src/pages/TradePatterns/tradePatternUtils.test.mjs`

Expected: all tests pass。

```powershell
git add -- src/pages/TradePatterns
git commit -m "feat(patterns): add pattern page model"
```

### Task 5: PC/H5 交易形态库页面

**Files:**
- Create: `src/pages/TradePatterns/TradePatternsPage.jsx`
- Modify: `src/pages/registry.js`
- Modify: `src/lib/constants.js`

- [ ] **Step 1: 实现页面数据层**

页面只能使用：

```js
const patterns = useTable('trade_patterns', { orderBy: 'origin_date', ascending: false, optional: true })
const updates = useTable('trade_pattern_updates', { orderBy: 'event_date', ascending: false, optional: true })
```

任一表缺失时渲染 `<TableMissing sql="v10_trade_patterns.sql" />`。新增保存使用 `patterns.add(normalizeDraft(...))`，图片使用 `uploadFile`。

- [ ] **Step 2: 实现响应式页面**

使用 `useIsMobile()`：移动端单列、筛选横向滚动、详情 Modal 宽度占满；PC 为 `repeat(auto-fill,minmax(290px,1fr))`。详情严格按“初始形态 / 图中事实 / 归纳规律 / 待定项 / 研究时间线”分区。

- [ ] **Step 3: 注册导航**

`registry.js` 增加 `patterns: TradePatternsPage`；`NAV_ITEMS` 在“交易每日一记”附近增加 `{ key:'patterns', label:'交易形态库', icon:'📐' }`。

- [ ] **Step 4: 构建、lint 并提交**

Run: `npm run build`

Expected: Vite build exit 0。

Run: `npx eslint src api scripts`

Expected: exit 0。

```powershell
git add -- src/pages/TradePatterns src/pages/registry.js src/lib/constants.js
git commit -m "feat(patterns): add responsive pattern library page"
```

### Task 6: 文档、迁移和历史 001～007 导入

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 文档化模块与同步命令**

README 模块表加入交易形态库；CLAUDE 模块地图加入页面、两张表、同步命令和安全边界。

- [ ] **Step 2: 执行迁移检查**

Run: `npm run sql -- --check`

Expected: token/project check succeeds。失败时不得查看或输出 `.env` 内容，记录外部阻塞并停止真实迁移/部署。

- [ ] **Step 3: 执行数据库迁移**

Run: `npm run sql -- supabase/v10_trade_patterns.sql`

Expected: migration succeeds。

- [ ] **Step 4: 干跑历史同步**

Run: `npm run sync:patterns -- --dry --pull-only`

Expected: detects source keys `001` through `007`, writes nothing。

- [ ] **Step 5: 正式导入并验证数量**

Run: `npm run sync:patterns -- --pull-only`

Expected: 7 patterns synced; rerun reports 7 unchanged and 0 duplicates。

- [ ] **Step 6: 提交文档**

```powershell
git add -- README.md CLAUDE.md
git commit -m "docs: document trade pattern library"
```

### Task 7: 最终验证与上线

**Files:**
- No new files unless verification exposes a defect.

- [ ] **Step 1: 全量本地验证**

Run: `npm run test:patterns`

Expected: all tests pass。

Run: `npm run build`

Expected: exit 0。

Run: `npx eslint src api scripts`

Expected: exit 0。

Run: `git diff --check`

Expected: no whitespace errors。

- [ ] **Step 2: 浏览器验收本地 PC/H5**

检查导航、7 张历史卡片、详情五层结构、图片、新增草稿、同步状态和 390px 移动宽度；新增测试草稿后运行 `--push-only`，确认只在 `trade/research/ideas` 下生成一个新目录，再删除该测试草稿与测试目录（只删除本任务明确创建的测试数据）。

- [ ] **Step 3: 推送上线**

Run: `git push origin main`

Expected: push succeeds and Vercel starts deployment。

- [ ] **Step 4: 检查线上部署**

使用已登录浏览器打开生产 URL，确认部署 commit、页面加载、Supabase 数据、图片、PC/H5；若 Vercel 构建失败，查看构建日志并修复后重新推送。

- [ ] **Step 5: 写交接记录**

报告：修改文件、测试输出、迁移结果、导入数量、生产 URL、线上健康状态、残余风险，以及明确“未影响交易策略/自动下单”。
