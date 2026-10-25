-- 泰语学习：逐项掌握标记 + 作业/复习答题记录。
-- item_key 以读音为准（w:单词读音 / l:句子读音），同一个词在不同天出现只记一次掌握。
create table if not exists thai_item_progress (
  id uuid primary key default gen_random_uuid(),
  course_version text not null,
  item_key text not null,
  mastered boolean not null default false,
  mastered_at timestamptz,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  streak integer not null default 0,
  last_result text check (last_result in ('right', 'wrong')),
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (course_version, item_key)
);
alter table thai_item_progress disable row level security;

create table if not exists thai_quiz_results (
  id uuid primary key default gen_random_uuid(),
  course_version text not null,
  scope text not null check (scope in ('day', 'review')),
  lesson_day integer check (lesson_day between 1 and 30),
  total integer not null,
  correct integer not null,
  wrong_keys jsonb not null default '[]'::jsonb,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table thai_quiz_results disable row level security;
