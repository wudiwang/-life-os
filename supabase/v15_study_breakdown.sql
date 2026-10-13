-- v15: 学习主线的子任务拆解（用户 2026-10-13「学习主线也这样拆下」）
-- 子任务【直接来自用户自己的需求单标题与时长】，不新增内容：
--   「英语：复习、听读和一轮口头表达」20分 → 复习 5 + 听读 8 + 口头表达 7
--   「泰语：听说模仿和一个生活情景」  10分 → 听说模仿 5 + 生活情景 5
-- 重复日沿用父需求单的 周一~周六（周日休息），完成标准沿用「忙碌日5分钟保底」的口径。
-- 用户提到的「运营类知识」尚未说明学什么，故不代为建项目。
-- 幂等：靠 parent_id + title 判重。
begin;

insert into work_todos(title, priority, project_id, parent_id, estimate_minutes,
                       repeat_weekdays, completion_criteria)
select v.title, 'mid', p.project_id, p.id, v.mins, p.repeat_weekdays, v.crit
from work_todos p,
     (values
       ('英语：复习、听读和一轮口头表达', '复习昨日内容',   5, '扫一遍昨天的词句即可，忙碌日跳过不补。'),
       ('英语：复习、听读和一轮口头表达', '听读一段',       8, '跟读一段材料，不要求听懂全部。'),
       ('英语：复习、听读和一轮口头表达', '口头表达一轮',   7, '开口说一轮，不要求流利，先留基线。'),
       ('泰语：听说模仿和一个生活情景',   '听说模仿',       5, '模仿发音即可，只改一个影响理解的问题。'),
       ('泰语：听说模仿和一个生活情景',   '练一个生活情景', 5, '点餐/问路等任一情景走一遍。')
     ) as v(parent, title, mins, crit)
where p.title = v.parent
  and p.parent_id is null
  and p.project_id in (select id from journal_threads where main_line = 'study')
  and not exists (select 1 from work_todos w where w.parent_id = p.id and w.title = v.title);

commit;
