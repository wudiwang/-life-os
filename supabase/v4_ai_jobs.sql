-- v4: 本机 AI 任务队列（网页/手机 → Supabase 队列 → 本机 Claude Code 订阅 → 写回）
-- 用途：快记提炼。网页把原文丢进队列，本机 npm run bot 的 worker 取走跑 claude -p，结果写回。
-- 好处：不需要内网穿透/公网 IP，手机在外网也能用；走订阅额度，不花 API 钱。

create table if not exists ai_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'refine_note',   -- 预留：将来别的本机 AI 活复用同一张表
  status text not null default 'pending',     -- pending / running / done / error / applied / dropped
  input text not null,                        -- 用户原话
  context text,                               -- 上下文（如今天已记的内容）
  result jsonb,                               -- 提炼结果（见 scripts/refine-prompt.mjs 的 schema）
  error text,
  source text default 'web',                  -- web / mobile / tg
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);
alter table ai_jobs disable row level security;
create index if not exists idx_ai_jobs_pending on ai_jobs(status, created_at);

-- 快记原文保底：AI 提炼前先把原话存这里，整理后的正文才进 content，两边都不丢
alter table journal_entries add column if not exists raw_input text;
