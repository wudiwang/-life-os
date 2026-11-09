-- 生活泰语：全天录音里听到/说过的泰语，由 scripts/voice-memos.mjs 整理写入，泰语页「🎧 生活」tab 展示。
-- thai 只用于发音（页面不显示泰文），roman/gloss 的记法与课程一致（gloss = '读音=中文 | 读音=中文'）。
-- kind: heard = 录音里真实出现的句子；wish = 我当时用中文/英语说了、泰语该怎么说。
create table if not exists thai_life_phrases (
  id uuid primary key default gen_random_uuid(),
  heard_on date not null,
  heard_at timestamptz,
  kind text not null default 'heard' check (kind in ('heard', 'wish')),
  thai text not null,
  roman text not null,
  zh text not null,
  gloss text,
  scene text,
  who text,
  said_zh text,
  source text,
  created_at timestamptz not null default now(),
  unique (heard_on, kind, roman)
);
alter table thai_life_phrases disable row level security;
create index if not exists idx_thai_life_day on thai_life_phrases(heard_on desc);
