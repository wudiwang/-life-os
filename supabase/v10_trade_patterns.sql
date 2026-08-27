-- v10 · 交易形态库：交易项目研究档案的移动端镜像与待写回队列

create table if not exists trade_patterns (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_project text not null default 'trade',
  title text not null,
  pattern_type text not null default 'case',
  status text not null default 'idea',
  origin_date date,
  direction text not null default 'unknown',
  symbol text,
  timeframe text,
  tags jsonb not null default '[]'::jsonb,
  original_quote text,
  observations text,
  hypotheses text,
  pending_questions text,
  image_url text,
  source_path text,
  source_hash text,
  sync_state text not null default 'pending_writeback',
  sync_error text,
  created_via text not null default 'life_os',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_patterns_status_check check (status in ('idea','researching','validated','invalidated','archived')),
  constraint trade_patterns_direction_check check (direction in ('long','short','both','unknown')),
  constraint trade_patterns_sync_check check (sync_state in ('pending_writeback','synced','sync_error'))
);

create table if not exists trade_pattern_updates (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references trade_patterns(id) on delete cascade,
  event_date date,
  update_type text not null default 'note',
  title text,
  content text not null,
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique(pattern_id, source_hash)
);

alter table trade_patterns disable row level security;
alter table trade_pattern_updates disable row level security;

create index if not exists idx_trade_patterns_status
  on trade_patterns(status, origin_date desc);
create index if not exists idx_trade_pattern_updates_pattern
  on trade_pattern_updates(pattern_id, event_date desc);
