-- ═══════════════════════════════════════════════════════════
-- v9 · 快记提炼结果推 TG
--
-- 之前的缺口：提炼完成后没有任何通知，结果静静躺在 ai_jobs.result 里等人打开网页确认。
-- 但"不打开网页"正是整套 TG 推送要解决的问题——快记链路自己却还留着同一个坑。
-- 结果就是 8/11 的两条快记提炼完了，好几天都没真正入库。
--
-- notified_at 记录"已经推给用户了"，避免 bot 每次重启就把老结果重推一遍。
-- ═══════════════════════════════════════════════════════════

alter table ai_jobs add column if not exists notified_at timestamptz;

-- 待推送队列：提炼好了、还没通知过的
create index if not exists idx_ai_jobs_notify on ai_jobs(status, notified_at);
