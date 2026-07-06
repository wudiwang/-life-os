-- ═══════════════════════════════════════════════════════════
-- 人生 OS · 个人管理系统 · v1 全量建表
-- 在 Supabase Dashboard → SQL Editor 粘贴执行（Run）
-- 与领航项目约定一致：所有表关闭 RLS（个人单用户系统）
-- ═══════════════════════════════════════════════════════════

-- ── 健康 ──────────────────────────────────────────────
create table if not exists health_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_type text not null,          -- weight/height/blood_pressure/heart_rate/blood_sugar/body_fat/sleep_hours/custom
  metric_name text,                   -- custom 时的名称
  value_num numeric not null,
  value2_num numeric,                 -- 血压舒张压等第二值
  unit text,
  measured_at timestamptz not null default now(),
  note text,
  created_at timestamptz default now()
);
alter table health_metrics disable row level security;

create table if not exists health_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  org text,                           -- 检测机构
  report_date date,
  file_url text,                      -- Supabase Storage 公开链接
  summary text,                       -- 手动摘要
  ai_review text,                     -- AI 解读
  created_at timestamptz default now()
);
alter table health_reports disable row level security;

-- ── 习惯 ──────────────────────────────────────────────
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '✅',
  target_per_week int default 7,      -- 每周目标次数
  remind_time text,                   -- HH:mm 提醒时间（展示用）
  active boolean default true,
  created_at timestamptz default now()
);
alter table habits disable row level security;

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  done boolean default true,
  note text,
  created_at timestamptz default now()
);
alter table habit_logs disable row level security;
create index if not exists idx_habit_logs_habit on habit_logs(habit_id, log_date);

-- ── 目标 ──────────────────────────────────────────────
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  level text not null default 'month',   -- year/quarter/month/short
  parent_id uuid references goals(id) on delete set null,
  start_date date,
  due_date date,
  status text not null default 'active', -- planning/active/done/dropped
  review_note text,                      -- 结项复盘
  created_at timestamptz default now()
);
alter table goals disable row level security;

create table if not exists goal_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  due_date date,
  check_criteria text,                   -- 验收标准
  status text not null default 'pending',-- pending/passed/partial/failed
  check_result text,                     -- 检查点录入的结果/自检
  checked_at timestamptz,
  created_at timestamptz default now()
);
alter table goal_milestones disable row level security;

create table if not exists goal_logs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  log_date date not null,
  content text not null,
  created_at timestamptz default now()
);
alter table goal_logs disable row level security;

-- ── 工作 ──────────────────────────────────────────────
create table if not exists work_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  priority text default 'mid',        -- high/mid/low
  due_date date,
  status text default 'open',         -- open/done
  done_at timestamptz,
  created_at timestamptz default now()
);
alter table work_todos disable row level security;

create table if not exists work_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  content text,                       -- 做了什么
  output text,                        -- 产出
  issues text,                        -- 问题/风险
  created_at timestamptz default now()
);
alter table work_logs disable row level security;

create table if not exists work_profile (
  id uuid primary key default gen_random_uuid(),
  field text not null,                -- duty(职责范围)/output(产出要求)/care(注意事项)
  content text,
  created_at timestamptz default now()
);
alter table work_profile disable row level security;

create table if not exists work_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dept text,
  role text,                          -- 职位
  relation text,                      -- 汇报人/上级/下级/同事/跨部门
  duties text,                        -- 其职责
  stance text,                        -- 相处姿态/注意点
  notes text,
  created_at timestamptz default now()
);
alter table work_contacts disable row level security;

-- ── 探索世界 ──────────────────────────────────────────
create table if not exists explore_records (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'experience', -- food/travel/experience/insight/other
  record_date date,
  location text,
  rating int,                         -- 1-5
  content text,
  photo_url text,
  created_at timestamptz default now()
);
alter table explore_records disable row level security;

-- ── 第二大脑 ──────────────────────────────────────────
create table if not exists knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,                      -- 专业/生活感悟/信息收藏…自由填写
  tags text,                          -- 逗号分隔
  content text,                       -- Markdown
  source text,                        -- 来源链接/出处
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table knowledge_notes disable row level security;

-- ── 情感关系 ──────────────────────────────────────────
create table if not exists relation_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rel_type text not null default 'friend', -- family/friend/love
  birthday date,
  closeness int default 3,            -- 亲密度 1-5
  notes text,
  created_at timestamptz default now()
);
alter table relation_people disable row level security;

create table if not exists relation_logs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references relation_people(id) on delete cascade,
  log_date date not null,
  event text,                         -- 发生了什么
  feeling text,                       -- 我的感受
  created_at timestamptz default now()
);
alter table relation_logs disable row level security;

-- ── 每日一记 ──────────────────────────────────────────
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  mood int,                           -- 1-5
  content text,
  gratitude text,                     -- 感恩/美好瞬间
  created_at timestamptz default now()
);
alter table journal_entries disable row level security;
create index if not exists idx_journal_date on journal_entries(entry_date);

-- ── AI 分析历史 ───────────────────────────────────────
create table if not exists ai_reviews (
  id uuid primary key default gen_random_uuid(),
  module text not null,               -- health/habits/goals/work/overall…
  prompt_summary text,                -- 分析请求摘要
  content text not null,              -- AI 输出
  created_at timestamptz default now()
);
alter table ai_reviews disable row level security;

-- ── 人生阶段面板 ──────────────────────────────────────
create table if not exists life_stage (
  id uuid primary key default gen_random_uuid(),
  field text not null,                -- stage(阶段定位)/focus(阶段重点)/advice(方向建议)
  content text,
  created_at timestamptz default now()
);
alter table life_stage disable row level security;

-- ═══════════════════════════════════════════════════════════
-- 别忘了：Storage → New bucket → 名称 attachments → Public
-- ═══════════════════════════════════════════════════════════
