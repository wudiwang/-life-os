-- ═══════════════════════════════════════════════════════════
-- v18 · 健康塑形：饮食 / 训练 / 每日身体数据
-- 录入由聊天入口的 AI 按 docs/塑形数据录入总则.md 写入；网页「健康塑形」页只做呈现。
-- 执行：npm run sql -- supabase/v18_shape.sql（或 Supabase SQL Editor 粘贴）
-- ═══════════════════════════════════════════════════════════

-- 每餐一行（一顿饭里多样东西合成一行，items 写清份量）
create table if not exists shape_food_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  meal text not null default 'snack',     -- breakfast/lunch/dinner/snack
  items text not null,                    -- 吃了什么 + 份量，如「去骨鸡腿 250g、西兰花 200g、橄榄油 10g」
  kcal numeric,
  protein_g numeric,
  fat_g numeric,
  sat_fat_g numeric,                      -- 饱和脂肪（2026-11-07 起：每天 ≤ 20g，盯 ApoB）
  net_carb_g numeric,
  basis text,                             -- label=按包装营养表 / estimate=按图或描述估算
  source text,                            -- photo/voice/text
  note text,
  created_at timestamptz default now()
);
alter table shape_food_logs disable row level security;
create index if not exists idx_shape_food_date on shape_food_logs(log_date);

-- 每次运动一行
create table if not exists shape_workouts (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  kind text not null default 'strength',  -- strength/cardio/walk/other
  title text not null,                    -- 如「力量 A 日」「坡度快走」
  detail text,                            -- 动作 × 重量 × 组 × 次，一行一个动作
  duration_min numeric,
  kcal numeric,                           -- 估算消耗（MET 法或手表读数）
  note text,
  created_at timestamptz default now()
);
alter table shape_workouts disable row level security;
create index if not exists idx_shape_workout_date on shape_workouts(log_date);

-- 每天一行：身体数据 + 教练点评
create table if not exists shape_daily (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  weight_kg numeric,                      -- 早上空腹
  waist_cm numeric,                       -- 最低肋骨与髂嵴连线中点，每周一次
  steps int,
  sleep_h numeric,
  active_kcal numeric,                    -- 手表「活动能量」，有就填（已含训练和走路）
  feeling text,                           -- 饿不饿/累不累/皮疹
  coach_note text,                        -- 当日点评 + 明天最该调整的一件事
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table shape_daily disable row level security;
