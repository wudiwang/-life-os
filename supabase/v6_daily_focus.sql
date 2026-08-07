-- ═══════════════════════════════════════════════════════════
-- v6 · 每日三向：固定思考方向打卡
-- 工作(职责边界) / 交易 / 生活健康(健身·饮食·人际)
-- 在 Supabase Dashboard → SQL Editor 粘贴执行（Run）
-- ═══════════════════════════════════════════════════════════

create table if not exists daily_focus (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  track text not null,                -- work/trade/life，取值见 constants.FOCUS_TRACKS
  content text,                       -- 今日思考/投入
  win text,                           -- 今日成就
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table daily_focus disable row level security;

-- 一天一个方向只留一条，重复写入走 update
create unique index if not exists idx_daily_focus_day_track on daily_focus(log_date, track);
create index if not exists idx_daily_focus_date on daily_focus(log_date);
