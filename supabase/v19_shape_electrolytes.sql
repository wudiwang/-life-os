-- ═══════════════════════════════════════════════════════════
-- v19 · 塑形饮食记录加电解质：钠 / 钾 / 镁（mg）
-- 由录入的 AI 按 docs/塑形数据录入总则.md 估算（包装食品按标签）。首页按天累计显示。
-- 执行：npm run sql -- supabase/v19_shape_electrolytes.sql
-- ═══════════════════════════════════════════════════════════
alter table shape_food_logs add column if not exists sodium_mg numeric;
alter table shape_food_logs add column if not exists potassium_mg numeric;
alter table shape_food_logs add column if not exists magnesium_mg numeric;
