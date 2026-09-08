begin;
alter table work_todos add column if not exists project_id uuid references journal_threads(id) on delete set null;
alter table work_todos add column if not exists estimate_minutes integer check (estimate_minutes between 1 and 1440);
alter table work_todos add column if not exists completion_criteria text;
alter table work_todos add column if not exists repeat_weekdays integer[];
create table if not exists todo_day_entries (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references work_todos(id) on delete cascade,
  log_date date not null,
  state text not null default 'open' check (state in ('open','done','skipped')),
  feedback text not null default '',
  actual_minutes integer check (actual_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(todo_id, log_date)
);
alter table todo_day_entries disable row level security;
insert into work_todos(title, priority, project_id, estimate_minutes, completion_criteria, repeat_weekdays)
select '英语：复习、听读和一轮口头表达', 'mid', id, 20,
  '20分钟或忙碌日5分钟即可；首次先留基线，不要求流利，不补积压课。', array[1,2,3,4,5,6]
from journal_threads where title = '英语学习｜12周工作沟通与表达'
and not exists(select 1 from work_todos where project_id=journal_threads.id and repeat_weekdays is not null);
insert into work_todos(title, priority, project_id, estimate_minutes, completion_criteria, repeat_weekdays)
select '泰语：听说模仿和一个生活情景', 'mid', id, 10,
  '10分钟或忙碌日5分钟即可；首次先做点餐基线，只改一个影响理解的问题。', array[1,2,3,4,5,6]
from journal_threads where title = '泰语学习｜12周当地生活沟通'
and not exists(select 1 from work_todos where project_id=journal_threads.id and repeat_weekdays is not null);
commit;
