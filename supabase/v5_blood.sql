-- v5: 血液检查记录（一次抽血 = 多条项目记录，按 test_date 分组展示）
-- 参考区间不进库：写在前端 constants.BLOOD_PANEL，改起来不用动数据。
-- ref_low / ref_high 只在报告单区间与默认值不同时才填，留空即用默认。

create table if not exists blood_metrics (
  id uuid primary key default gen_random_uuid(),
  test_date date not null,
  panel_key text not null,        -- 对应 constants.BLOOD_PANEL 的 key，如 TG / UA / ALT
  value_num numeric not null,
  unit text,
  ref_low numeric,                -- 报告单标注的区间（与默认不同时才填）
  ref_high numeric,
  org text,                       -- 检测机构
  note text,
  created_at timestamptz default now()
);
alter table blood_metrics disable row level security;
create index if not exists idx_blood_date on blood_metrics(test_date desc);
create index if not exists idx_blood_key on blood_metrics(panel_key, test_date desc);
