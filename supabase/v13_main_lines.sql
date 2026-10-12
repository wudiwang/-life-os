-- v13: 三大主线 + 需求单/子任务层级（用户 2026-10-13）
-- 用户要求首页按「项目 → 需求单 → 子任务」重构，并以三大主线分组：
--   manage 领航项目管理工作 / health 健康 / study 学习
-- 刻意【不改动 journal_threads.track】：track 被 dailyActions.js、project-sync-config.mjs
-- 等处硬编码依赖，改它会连锁破坏。故新增独立的 main_line 列表达主线。
begin;

-- ① 需求单 → 子任务：work_todos 自引用。parent_id 为空=需求单，非空=子任务。
alter table work_todos add column if not exists parent_id uuid references work_todos(id) on delete cascade;
create index if not exists idx_work_todos_parent on work_todos(parent_id);

-- ② 项目归属三大主线
alter table journal_threads add column if not exists main_line text
  check (main_line in ('manage','health','study'));
create index if not exists idx_threads_main_line on journal_threads(main_line, sort_order);

-- ③ 把已有项目归类（按标题匹配，幂等）
update journal_threads set main_line='manage'
  where main_line is null and track='work';
update journal_threads set main_line='health'
  where main_line is null and (title like '%健身%' or title like '%饮食%' or title like '%健康%');
update journal_threads set main_line='study'
  where main_line is null and (title like '%英语%' or title like '%泰语%' or title like '%学习%');

commit;
