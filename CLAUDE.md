# 人生 OS · 个人管理系统 (life-os)

个人生活管理系统。React 19 + Vite 前端(Vercel) + Supabase(Postgres) + Vercel Serverless (`api/*.js`) + Claude API。纯 inline 样式(无 Tailwind)，zustand 管全局态，无 react-router（App.jsx 经 `pages/registry.js` 切页）。架构与 lh-pm-workbench（领航）一致。

## 约定（IMPORTANT）

1. **双模式数据层**：所有数据读写必须走 `src/lib/dataStore.js` 的 `db.*`（list/insert/update/remove）。它在无 Supabase 密钥时自动降级 localStorage 演示模式。**不要在页面里直接 import supabase client**。
2. **DDL 不走 REST**：建表/改列写 `supabase/vN_*.sql`（版本递增），由用户在 Supabase SQL Editor 手动执行。新表必须 `disable row level security`。
3. **密钥绝不进 git**：`.env` 已被 gitignore。服务端密钥（CLAUDE_API_KEY）只放 Vercel 环境变量。
4. **时间展示北京时间**：数据库存 UTC（timestamptz），展示用 `src/lib/date.js` 的工具函数。
5. 纯 inline 样式，色板用 `src/lib/constants.js` 的 `COLORS`；主蓝 `#3B82F6`。

## 部署链路

```
git push origin main → Vercel 自动构建发布（约1-2分钟）
```

## 模块地图（src/pages/ + registry.js 登记）

| 页面 | 文件 | 说明 |
|---|---|---|
| 人生看板 | Dashboard/DashboardPage | 今日概览 + 人生阶段面板(life_stage 表) + 检查点提醒 |
| 每日一记 | Journal/JournalPage | 心情(1-5)+文字+感恩，心情曲线 |
| 健康 | Health/HealthPage | 指标(tabs) + 体检报告；指标类型定义在 constants.METRIC_TYPES |
| 习惯 | Habits/HabitsPage | 7天打卡网格 + streak；habit_logs 以 (habit_id, log_date) 判打卡 |
| 目标 | Goals/GoalsPage | 目标卡片 + 详情弹窗(里程碑/检查点自检/过程记录/复盘) |
| 工作 | Work/WorkPage | 4 tabs：待办/日志/职责档案(work_profile.field)/人际地图 |
| 探索世界 | Explore/ExplorePage | 分类卡片流，照片走 uploadFile |
| 第二大脑 | Knowledge/KnowledgePage | Markdown 笔记(react-markdown) + 搜索 |
| 情感关系 | Relations/RelationsPage | 三类人档案 + 互动记录 + 生日/60天失联提醒 |
| AI 分析 | AI/AIPage | 摘要构建在 lib/aiSummary.js → POST /api/ai-review |
| 设置 | Settings/SettingsPage | 连接状态/JSON 备份导出/清空演示数据 |

新增页面需要：写页面组件 + 在 `src/pages/registry.js` 登记 + `src/lib/constants.js` 的 NAV_ITEMS 加菜单项。

## 数据层

- 通用 hook：`src/hooks/useTable.js`（rows/loading/add/patch/del/reload），opts 走 JSON 序列化做依赖，可放心传字面量。
- 附件上传：`dataStore.uploadFile(file)` → Supabase Storage bucket `attachments`（演示模式转 base64，限 1.5MB）。
- 全部表清单：`constants.ALL_TABLES`（备份导出用，新表要同步加）。

## Serverless (api/)

- `api/ai-review.js`：POST {module, dataSummary, question?} → Claude API（model: claude-opus-4-8），返回 {content}。密钥读 `process.env.CLAUDE_API_KEY`。

## AI 分析的两条路

1. 在线：AIPage → /api/ai-review（需 Vercel 配 CLAUDE_API_KEY）；
2. 本机：`npm run ai [模块] [问题]`（scripts/ai-review-local.mjs）——拉 Supabase 数据 → `claude -p`（本机 Claude Code 订阅）→ 写回 ai_reviews 表，网页/手机看历史。

## 移动端

`hooks/useIsMobile.js`（≤768px）；MainLayout 移动端为顶栏+抽屉导航（NavContent 与桌面侧栏共用）；宽表格用 `common/StatCard.jsx` 的 `ScrollX` 包裹横滑。

## 检查点（每次改动后）

```
npm run build && npx eslint src api
```

两者全绿才算完成。eslint 已关闭 `react-hooks/set-state-in-effect`（数据加载模式误报）。
