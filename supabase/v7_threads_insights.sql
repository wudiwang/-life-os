-- ═══════════════════════════════════════════════════════════
-- v7 · 主线 + 启示
-- 解决：随笔越记越杂、同一个想法反复沉淀成多条
-- 主线(journal_threads) = 长期在推进的线索，带「当前结论」和「下一步」
-- 启示(insights)        = 可复用的经验，带 hits 计数（同一想法再说一次就 +1，不新建）
-- 在 Supabase Dashboard → SQL Editor 粘贴执行（Run）
-- ═══════════════════════════════════════════════════════════

create table if not exists journal_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  track text,                              -- work/trade/life/other，对齐 constants.FOCUS_TRACKS
  summary text,                            -- 这条主线目前的结论/进展
  next_action text,                        -- 下一步具体做什么
  status text not null default 'active',   -- active/paused/done
  sort_order int not null default 0,
  mention_count int not null default 0,    -- 被随笔提及的次数
  last_noted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table journal_threads disable row level security;
create index if not exists idx_threads_status on journal_threads(status, sort_order);

create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references journal_threads(id) on delete set null,
  title text not null,                     -- 一句话启示
  detail text,                             -- 为什么成立 / 以后怎么用
  track text,
  source_quote text,                       -- 触发它的原话摘要
  source_date date,
  hits int not null default 1,             -- 这个想法被重复提到过几次
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table insights disable row level security;
create index if not exists idx_insights_active on insights(active, hits desc, updated_at desc);

-- ── 种子数据：从 2026-08-05 ~ 08-08 的随笔里归纳出来的三条主线 ──
-- 仅在表为空时写入，重复执行本文件不会产生重复行
insert into journal_threads (title, track, summary, next_action, sort_order, mention_count, last_noted_at)
select * from (values
  (
    '把 PM 的职责边界做到「让人无话可说」',
    'work',
    E'定位（江清月给的）是「对外」，拆成两条腿：需求承接 + 段总大项目的进度跟进与反馈。\n方法是以产出为目标售卖时间——领导关心的事项纳入本周重点，再倒推产出。\n真正决定评价的不是职责做没做到（那是底线），而是能否抓住对方要的那个重点。',
    '输出段总项目的初步落地规划（原定 8/5，已逾期）',
    1, 3, now()
  ),
  (
    '把交易变成每日固定投入，而不是缺钱才想起',
    'trade',
    E'已经想清楚的：关注的不是单次盈亏，而是思考的质量和前进的步伐——只沉迷买卖的输赢，交易十年也是原地踏步。\n但目前这条线在系统里是空的：有总纲、有决心，一条真实的交易记录/复盘/假设验证都没有。',
    '今天先补一条交易记录，哪怕只写一句判断',
    2, 2, now()
  ),
  (
    '长期能力与习惯：健身 / 饮食 / 早睡 / 表达',
    'life',
    E'健身已成习惯（每天 5-6pm）。饮食、早睡还没有稳定的记录。\n表达能力想用短视频记录 + 第三视角回看的方式练，还没开始。\n体成分数据停在 6/29，之后断更。',
    '补一次 InBody 体测，把断掉的曲线接上',
    3, 2, now()
  )
) as seed(title, track, summary, next_action, sort_order, mention_count, last_noted_at)
where not exists (select 1 from journal_threads);

-- ── 种子数据：五条会影响后续行为的启示 ──
insert into insights (title, detail, track, source_quote, source_date, hits)
select * from (values
  (
    '迭代必须先有方向，否则等于原地打转',
    '「一万次迭代」这个准则本身不产生长进——迭代要先有明确方向，并且立刻投入执行。只定准则不定方向，每天看似在努力，实际在虚度。自检：每天开始前先确认今天迭代的是哪个方向，没有明确对象的思考不算数。',
    'life', '方向不够明确，该做的有效迭代没有马上投入去做，结果每天其实是在虚度光阴', '2026-08-08'::date, 2
  ),
  (
    '职责做到位只是底线，抓住对方要的重点才决定评价',
    '做项目经理，把职责范围做完只是及格线。真正决定别人怎么评价你的，是能否设身处地识别对方（尤其直属领导）关心什么、什么才算他满意，再据此组织自己的呈现方式。做到让别人无话可说，比自己觉得做得好更重要。',
    'work', '需要换位思考，尤其是对直属领导——他关心什么事项、怎么才能让他满意', '2026-08-08'::date, 2
  ),
  (
    '以产出为目标售卖时间',
    '工作范围要主动固定下来，而不是被动接活。做法：每周开始时先明确领导的关注点 → 定义本周产出 → 再倒推排时间。售卖的是时间对应的产出，不是时间本身。',
    'work', '以产出为目标去规划，去售卖我的时间', '2026-08-05'::date, 1
  ),
  (
    '交易的意义在思考质量，不在单次盈亏',
    '如果只沉迷于买卖带来的奖励与失去、痛苦与快乐的轮回，交易十年也只会原地踏步。要记录的是每次交易背后的思考与假设、验证结果与修正——没有记录就没有迭代。',
    'trade', '关注的不是单次盈亏，而是思考的质量和前进的步伐', '2026-08-08'::date, 1
  ),
  (
    '别在他人的评论里消耗情绪',
    '遇到喜欢评论、指导别人按自己意愿做事的人（如复印店那位），正确处理是零成本略过——对方的表达欲不是你的问题。为这类事产生"无语"的情绪，等于把当天有限的心力浪费在完全不可控、也不重要的事情上。',
    'life', '怎么会有这么喜欢评论别人、指导别人按自己意愿做事的人', '2026-08-06'::date, 1
  )
) as seed(title, detail, track, source_quote, source_date, hits)
where not exists (select 1 from insights);

-- 把启示挂到对应主线上（按 track 对齐）
update insights i set thread_id = t.id
from journal_threads t
where i.thread_id is null and i.track = t.track;
