-- v14: 健康主线的「项目 → 需求单 → 子任务」样板（用户 2026-10-13 口述内容）
-- 用户原话：「健康饮食与运动：比如吃饭要干净、控制热量，具体动作就是饭前拍照记录；
--            运动也要保证适量，每天去完成对应的运动动作。」
-- 只建用户明确说过的部分；管理工作的「三个大目标」用户尚未给出，故不代为编造。
-- 幂等：靠标题判重，重复执行不会产生副本。
begin;

insert into journal_threads(title, track, main_line, status, sort_order, summary, next_action)
select '健康管理｜体重 · 饮食 · 运动', 'life', 'health', 'active', 6,
       '体重回到正常区间：吃干净、控总热量、每天动起来、睡够。',
       '先把饭前拍照和当日总热量两件事做满一周。'
where not exists (select 1 from journal_threads where title = '健康管理｜体重 · 饮食 · 运动');

-- 需求单（parent_id 为空）
insert into work_todos(title, priority, project_id, completion_criteria)
select v.title, 'high', t.id, v.crit
from journal_threads t,
     (values ('饮食：吃干净 + 控住总热量', '每天有拍照留痕，且当日总热量记录完整。'),
             ('运动：有氧 + 无氧都做到', '当天对应的运动动作完成即可，不求强度。'),
             ('睡眠：固定就寝时间',       '记录入睡时间；偶尔晚睡不算失败，看周趋势。')) as v(title, crit)
where t.title = '健康管理｜体重 · 饮食 · 运动'
  and not exists (select 1 from work_todos w where w.project_id = t.id and w.title = v.title);

-- 子任务（parent_id 指向对应需求单），每天重复
insert into work_todos(title, priority, project_id, parent_id, estimate_minutes, repeat_weekdays, completion_criteria)
select v.title, 'mid', p.project_id, p.id, v.mins, array[0,1,2,3,4,5,6], v.crit
from work_todos p,
     (values ('饮食：吃干净 + 控住总热量', '饭前拍照记录',     2, '每餐开动前拍一张，不修图不评判。'),
             ('饮食：吃干净 + 控住总热量', '记录当日总热量',   3, '睡前填当日合计，估算也算。'),
             ('运动：有氧 + 无氧都做到',   '完成当日有氧',    20, '快走/慢跑/骑行均可，时长自定。'),
             ('运动：有氧 + 无氧都做到',   '完成当日无氧',    15, '任一部位力量训练即可。'),
             ('睡眠：固定就寝时间',        '记录入睡时间',     1, '只记时间，不做评价。'))
       as v(parent, title, mins, crit)
where p.title = v.parent and p.parent_id is null
  and p.project_id = (select id from journal_threads where title = '健康管理｜体重 · 饮食 · 运动')
  and not exists (select 1 from work_todos w where w.parent_id = p.id and w.title = v.title);

commit;
