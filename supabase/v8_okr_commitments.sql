-- ═══════════════════════════════════════════════════════════
-- v8 · 人生 OKR + 行为契约 + 原则落实
--
-- 设计原则（important，改这块前先读）：
--   1. 结果指标只在「回顾」时看，绝不做每日鞭子。个人给自己定 KPI，
--      裁判和运动员是同一个人，用结果指标每天自评必然走向放水或弃疗。
--   2. 每日/每周层面只考核「动作做没做」——二元判定，无法自欺。
--      okr_objectives 存方向和衡量口径，weekly_actions 存真正被打卡的动作。
--   3. principle_logs 独立于三向：核心原则每天必须被兑现一次并留下痕迹，
--      地位高于任何一个方向。skipped=true 是诚实选项，比不填有价值。
--
-- 执行：npm run sql -- supabase/v8_okr_commitments.sql
--       （没配 SUPABASE_ACCESS_TOKEN 就去 Supabase Dashboard → SQL Editor 粘贴执行）
-- ═══════════════════════════════════════════════════════════

-- ── 年度 / 季度 Objective ──────────────────────────────────
create table if not exists okr_objectives (
  id uuid primary key default gen_random_uuid(),
  level text not null,                     -- year / quarter
  period text not null,                    -- '2026' / '2026Q3'
  title text not null,                     -- Objective 本身
  track text,                              -- work/trade/life，对齐 constants.FOCUS_TRACKS
  why text,                                -- 为什么这条重要（回顾时用来判断要不要继续）
  metric text,                             -- 衡量口径（只回顾看，不做每日考核）
  metric_target text,
  metric_current text,
  status text not null default 'active',   -- active / done / dropped
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table okr_objectives disable row level security;
create index if not exists idx_okr_period on okr_objectives(status, level, period, sort_order);

-- ── 行为契约：每周要做几次的固定动作 ──────────────────────
create table if not exists weekly_actions (
  id uuid primary key default gen_random_uuid(),
  title text not null,                     -- 动作名，必须是动作而不是目标
  detail text,                             -- 物化：具体做什么，1234
  track text,
  objective_id uuid references okr_objectives(id) on delete set null,
  per_week int not null default 1,         -- 每周目标次数
  weekdays text,                           -- 可选固定星期，'1,3,5'（1=周一）；空=不限
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table weekly_actions disable row level security;
create index if not exists idx_weekly_actions_active on weekly_actions(active, sort_order);

create table if not exists weekly_action_logs (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references weekly_actions(id) on delete cascade,
  log_date date not null,
  note text,
  created_at timestamptz default now()
);
alter table weekly_action_logs disable row level security;
-- 一个动作一天只算一次
create unique index if not exists idx_wal_action_day on weekly_action_logs(action_id, log_date);
create index if not exists idx_wal_date on weekly_action_logs(log_date);

-- ── 核心原则每日落实 ──────────────────────────────────────
create table if not exists principle_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  content text,                            -- 今天这条原则落在哪件具体的事上
  skipped boolean not null default false,  -- 诚实选项：今天没落实（记录比空着有价值）
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table principle_logs disable row level security;
create unique index if not exists idx_principle_day on principle_logs(log_date);

-- ═══════════════════════════════════════════════════════════
-- 种子数据：仅在表为空时写入，重复执行本文件不会产生重复行
-- 依据 2026-08-05 ~ 08-11 的随笔归纳：现阶段收敛到三条战线
--   ① 工作可见性（现金流，也是焦虑的正面战场）
--   ② 睡眠（其他一切的乘数，不是加数）
--   ③ 交易系统迭代（已有惯性，第二曲线的种子）
-- ═══════════════════════════════════════════════════════════

insert into okr_objectives (level, period, title, track, why, metric, metric_target, sort_order)
select * from (values
  (
    'year', '2026',
    '让这份远程工作变得难以替换，同时长出第一笔非工资收入',
    'work',
    E'远程工作的真实风险不是能力不够，是价值不可见。\n副业不是为了发财，是为了买保险——真正让人不焦虑的不是接受最坏结果，是知道最坏结果来时自己有路。',
    '① 周报连续未断周数 ② 非工资收入是否破零',
    '周报 ≥40 周 / 非工资收入 >0', 1
  ),
  (
    'quarter', '2026Q3',
    '把我的价值变成每周可见的交付物',
    'work',
    E'职责做到位只是底线，抓住对方要的重点才决定评价。\n远程办公的困境是「努力」和「被看见」之间的链路断了——办公室里加班到 8 点老板看得见，远程干到凌晨 3 点没人知道。\n解法不是更努力，是主动制造可见性。',
    '每周五周报连续未断的周数',
    '本季 13 周不断', 2
  ),
  (
    'quarter', '2026Q3',
    '把睡眠稳住，作为其他一切的地基',
    'life',
    E'8/8 那条随笔写于凌晨 3:23。睡眠紊乱会形成闭环：睡不好→白天状态差→产出少→焦虑→更睡不好。\n小事引发不成比例的烦躁（8/6 复印店那次心情 2 分），通常是睡眠债的信号，不是那件事本身的问题。\n如果只能改一件事，改睡眠的杠杆最高——它是其他所有事的乘数。',
    '每周 23:30 前上床的天数',
    '每周 ≥5 天', 3
  ),
  (
    'quarter', '2026Q3',
    '交易系统跑通一轮完整的「假设 → 验证 → 修正」',
    'trade',
    E'关注的不是单次盈亏，而是思考的质量——只沉迷买卖输赢，交易十年也是原地踏步。\n难度巨高，所以定性是：持续投入但严格限时，不抱期望，只要求留下可复用的记录。',
    '完整闭环的假设验证次数',
    '本季 ≥3 轮', 4
  )
) as seed(level, period, title, track, why, metric, metric_target, sort_order)
where not exists (select 1 from okr_objectives);

-- 行为契约：只留 4 条。动作数量和执行率成反比，能压就压。
insert into weekly_actions (title, detail, track, per_week, weekdays, sort_order)
select * from (values
  (
    '周五给直属领导发 5 行周报',
    E'不等人要，主动发。固定五行：\n1. 本周推动了什么（带结果，不是带忙碌）\n2. 遇到什么风险、我怎么处理的\n3. 下周计划\n4. 需要你支持的\n5. 一句话结论\n这一个动作能消掉大约七成的远程焦虑——它把「领导怎么看我」从未知变成由你主动定义。',
    'work', 1, '5', 1
  ),
  (
    '收工前 15 分钟过一遍所有项目',
    E'一张表过完，四列：进度 / 风险 / 我今天推了什么 / 明天卡谁。\n把「review、催、报风险、拉会」四个动作压成一个——列成四条会变成四份负担。\n同时它是收工仪式：写完就关电脑，把工作和生活物理切开。',
    'work', 5, null, 2
  ),
  (
    '23:30 前上床',
    E'二元判定，不看睡没睡着，只看有没有躺下。\n这是本季度杠杆最高的一条，优先级高于任何一条「提升类」动作。',
    'life', 7, null, 3
  ),
  (
    '交易系统留下一条记录',
    E'一句判断也算数：现在的仓位背后是什么逻辑、还成立吗、今天最该记住的教训是什么。\n严格限时，不要吃掉工作和睡眠的时间——难度巨高，投入要持续但要小。',
    'trade', 3, null, 4
  )
) as seed(title, detail, track, per_week, weekdays, sort_order)
where not exists (select 1 from weekly_actions);

-- 把行为契约挂到对应的季度 Objective 上（按 track 对齐）
update weekly_actions a set objective_id = o.id
from okr_objectives o
where a.objective_id is null and o.level = 'quarter' and a.track = o.track;
