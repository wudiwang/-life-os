-- Only the user's latest self-reported practice per lesson. Not a mastery score.
create table if not exists thai_learning_progress (
  id uuid primary key default gen_random_uuid(),
  course_version text not null,
  lesson_day integer not null check (lesson_day between 1 and 30),
  practiced_at timestamptz not null,
  practiced_on date not null,
  created_at timestamptz not null default now(),
  unique (course_version, lesson_day)
);
-- Follow this single-user project's existing dataStore access model.
alter table thai_learning_progress disable row level security;
