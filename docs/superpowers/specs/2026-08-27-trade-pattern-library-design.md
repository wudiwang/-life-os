# 人生 OS · 交易形态库跨项目设计

## 目标

在人生 OS 增加独立「交易形态库」页面，集中展示交易系统中已经保存的原始形态、用户原话、归纳规律、待定项与研究时间线。页面支持新增形态，但 `C:\Users\ADMIN\trade\research\ideas\` 继续作为唯一研究档案源；人生 OS 的 Supabase 只承担移动端可访问的镜像和待写回队列。

首批必须导入现有 `research/ideas/001～007`，以后新增案例可从人生 OS 网页上传，也可继续直接在交易项目归档，两边通过本机同步程序幂等汇合。

## 方案比较

### 方案 A：Supabase 镜像 + 本机双向同步（采用）

- 交易项目 → Supabase：扫描 `research/ideas/*/idea.md`、`timeline.md` 和图片，解析后按 `source_key` 幂等更新。
- 人生 OS → 交易项目：网页新增记录写入 `trade_patterns`，状态为 `pending_writeback`；本机同步程序生成下一个安全编号目录、保存原话和图片，再把状态改为 `synced`。
- 优点：手机和公网可用；交易仓库仍是唯一源；离线时任务可排队；不会让 Vercel 直接访问本机。
- 代价：本机同步程序需要周期运行，刚在手机新增的记录可能短暂显示“等待写回”。

### 方案 B：人生 OS 直接读取本地交易目录（不采用）

- Vercel 浏览器无法访问 `C:\Users\ADMIN\trade`，必须额外暴露本机服务或内网穿透。
- 安全边界和在线稳定性差。

### 方案 C：Supabase 成为独立主数据源（不采用）

- 网页编辑方便，但会与 Git 研究档案形成双主源，后续容易出现原话、截图和规则版本冲突。

## 产品结构

新增导航项：`📐 交易形态库`。

### 列表页

- 顶部统计：全部形态、灵感收藏、研究中、已形成规律、已证伪。
- 筛选：状态、标签、方向；关键词搜索标题、原话和规律。
- 卡片内容：封面图、编号与标题、状态、日期、标签、原话摘要、同步状态。
- PC 使用自适应多列卡片；H5 使用单列卡片与适合触摸的筛选区。

### 详情页/弹窗

内容固定分层，避免把后来归纳覆盖掉最初记录：

1. **初始形态**：原始截图、用户原话、来源日期、标的/周期（有数据时）。
2. **图中事实**：只写截图和原始档案能直接支持的观察。
3. **归纳规律**：当前可验证假设与规则表达。
4. **待定项**：尚未量化或尚未确认的边界。
5. **研究时间线**：澄清、规则版本、回测、证伪和结论，按时间倒序。

### 新增形态

- 必填：标题或一句原话、至少一张截图。
- 可选：标的、周期、标签、初步观察。
- 图片先上传现有 Supabase `attachments` bucket。
- 保存后立即出现在页面，状态为“等待写回交易档案”。
- 本机同步成功后显示交易项目目录和 `synced` 状态。

第一版不从网页删除交易仓库中的历史案例。网页删除仅对尚未写回的草稿开放；已写回记录只能归档，防止跨项目误删。

## 数据模型

### `trade_patterns`

- `id uuid primary key`
- `source_key text unique`：如 `007-strong-mover-top-weak-rebound`；网页草稿先使用 `web-<uuid>`。
- `source_project text default 'trade'`
- `title text not null`
- `pattern_type text`：`strategy` / `principle` / `case`
- `status text`：`idea` / `researching` / `validated` / `invalidated` / `archived`
- `origin_date date`
- `direction text`：`long` / `short` / `both` / `unknown`
- `symbol text`、`timeframe text`
- `tags jsonb`
- `original_quote text`
- `observations text`
- `hypotheses text`
- `pending_questions text`
- `image_url text`
- `source_path text`
- `source_hash text`
- `sync_state text`：`pending_writeback` / `synced` / `sync_error`
- `sync_error text`
- `created_via text`：`trade_import` / `life_os`
- `created_at timestamptz`、`updated_at timestamptz`

### `trade_pattern_updates`

- `id uuid primary key`
- `pattern_id uuid references trade_patterns(id) on delete cascade`
- `event_date date`
- `update_type text`：`clarification` / `rule` / `backtest` / `validation` / `invalidation` / `note`
- `title text`
- `content text not null`
- `source_hash text`
- `created_at timestamptz`

两张表加入 `ALL_TABLES`，迁移文件为 `supabase/v10_trade_patterns.sql`，按项目约定关闭 RLS。

## 跨项目同步

新增 `scripts/sync-trade-patterns.mjs`：

1. 只在本机运行，固定允许目录为 `C:\Users\ADMIN\trade\research\ideas`。
2. 扫描编号目录，解析 YAML front matter 和已知 Markdown 标题；解析不了的内容保留在原始文本字段，不猜测。
3. 图片上传到 `attachments/trade-patterns/<source_key>/`，以内容哈希避免重复上传。
4. 按 `source_key` upsert `trade_patterns`，按内容哈希 upsert 时间线条目。
5. 查询 `pending_writeback` 草稿；校验文件名、编号和目标绝对路径必须位于允许目录内。
6. 使用最大现有编号 + 1 创建目录，写入 `idea.md`、`timeline.md` 和 `assets/original.<ext>`；用户原话原样保存。
7. 成功后更新 `source_key/source_path/sync_state`；失败只写 `sync_error`，不删除网页草稿。

命令：

```text
npm run sync:patterns
npm run sync:patterns -- --dry
npm run sync:patterns -- --pull-only
npm run sync:patterns -- --push-only
```

同步必须幂等；重复运行不增加记录、不重复时间线、不覆盖用户在交易项目手工补充的 Markdown。

## 数据流与安全边界

```text
trade/research/ideas ──本机 pull──> Supabase 镜像 ──> 人生 OS 页面
人生 OS 新增 ──> pending_writeback ──本机 push──> trade/research/ideas
```

- 页面和同步程序均不读取或修改交易 API 密钥。
- 同步程序不能写入 `app/engine`、`config.yaml`、`.env` 或任何策略执行目录。
- 新增形态不会自动转成策略、信号或自动下单规则。
- 用户原话与归纳规律使用独立字段，任何同步不得用归纳内容覆盖原话。
- 图片上传失败、表缺失或本机离线时，页面明确展示错误/等待状态。

## 页面实现边界

- 新增 `src/pages/TradePatterns/TradePatternsPage.jsx`。
- 在 `src/pages/registry.js` 和 `NAV_ITEMS` 注册。
- 使用 `useTable` 和 `db.*`，页面不得直接导入 Supabase client。
- 表不存在时显示 `<TableMissing sql="v10_trade_patterns.sql" />`。
- 使用现有 `COLORS`、`Modal`、`FormField`、`uploadFile` 和 `useIsMobile`。
- 不引入新的 UI 框架、路由或状态管理方案。

## 历史导入

- 首次部署前运行 pull，同步 `001～007`。
- 每条至少保留标题、状态、日期、标签、原话、图片、归纳段落、待定项和 timeline。
- 缺字段保持空值；不得根据截图或文件名自行补造。
- 页面显示导入数量和最后同步状态，便于发现漏项。

## 验证与上线

1. 单元测试覆盖 Markdown 解析、编号分配、路径越界拒绝、幂等 upsert 和 pending 写回。
2. 页面测试覆盖历史卡片、筛选、详情分层、移动端布局和表缺失提示。
3. 执行 `npm run build` 与 `npx eslint src api scripts`。
4. 执行 `npm run sql -- supabase/v10_trade_patterns.sql`；若运行环境没有 Management API 权限，停止数据库/部署步骤并明确报告，不读取或输出秘密。
5. 运行历史同步，确认 `001～007` 共 7 条且图片可访问。
6. 提交并推送 `main`，等待 Vercel 构建，检查线上 PC/H5 页面、导航、图片和详情。

## 完成标准

- 人生 OS 有独立「交易形态库」页面。
- 历史 001～007 全部显示，初始形态与归纳规律分层清晰。
- 网页可以新增截图与原话，并显示待写回状态。
- 本机同步可安全写回交易项目且重复运行幂等。
- 数据库、构建、lint、线上 PC/H5 均通过验证。
- 未修改交易策略、下单逻辑或任何密钥。
