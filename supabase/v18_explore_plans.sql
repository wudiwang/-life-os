-- v18 · 探索世界计划
-- 行程 explore_plans + 分类清单 explore_plan_items（打卡 / 自己的照片 / 感想）
-- 封面图是 Wikimedia Commons 自由授权缩略图，没有合适图的条目留空，页面用色块。
-- 种子只在一张计划都没有时写入。重复执行本文件不会复制曼谷行程；
-- 若种子写到一半失败，按 seed_key 把缺的清单补上。

create table if not exists explore_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  place text,
  start_date date,
  end_date date,
  note text,
  emoji text,
  sort_order integer not null default 0,
  seed_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists explore_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references explore_plans(id) on delete cascade,
  category text not null default 'daily',
  title text not null,
  note text,
  image_url text,
  emoji text,
  sort_order integer not null default 0,
  done boolean not null default false,
  done_on date,
  reflection text,
  rating smallint,
  photos jsonb not null default '[]'::jsonb,
  seed_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint explore_plan_items_category_check check (category in ('food', 'nightlife', 'culture', 'experience', 'daily')),
  constraint explore_plan_items_rating_check check (rating is null or rating between 1 and 5)
);

alter table explore_plans disable row level security;
alter table explore_plan_items disable row level security;

create index if not exists idx_explore_plan_items_plan
  on explore_plan_items(plan_id, sort_order);

insert into explore_plans (title, place, start_date, end_date, note, emoji, sort_order, seed_key)
select
  'Bangkok 一周慢游 10/27–11/2',
  'Bangkok',
  '2026-10-27'::date,
  '2026-11-02'::date,
  '吃、夜生活、寺庙和近郊一天行程。勾选、拍一张、写一句感想就够。',
  '🇹🇭',
  1,
  'bangkok-2026-10'
where not exists (select 1 from explore_plans);

insert into explore_plan_items (plan_id, category, title, note, image_url, emoji, sort_order, seed_key)
select p.id, v.category, v.title, v.note, nullif(v.image_url, ''), v.emoji, v.sort_order::int, v.seed_key
from explore_plans p
cross join (values
  ('food', 'Jay Fai 蟹肉煎蛋', '周三至周六，只收现金，门口排队', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Jay_Fai%2C_bangkok_20180406.jpg/960px-Jay_Fai%2C_bangkok_20180406.jpg', '🦀', '1', 'bkk-jay-fai'),
  ('food', 'Thipsamai 泰式炒河粉', '老店炒河粉，点虾仁那份', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Thipsamai_%28September_2016%29.jpeg/960px-Thipsamai_%28September_2016%29.jpeg', '🍜', '2', 'bkk-thipsamai'),
  ('food', '唐人街 Yaowarat 夜游小吃', '晚上沿街吃，随便坐下', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/2016_Bangkok%2C_Dystrykt_Samphanthawong%2C_Ulica_Yaowarat_%2802%29.jpg/960px-2016_Bangkok%2C_Dystrykt_Samphanthawong%2C_Ulica_Yaowarat_%2802%29.jpg', '🏮', '3', 'bkk-yaowarat'),
  ('food', 'Le Du 品鉴菜单', '提前订位，按品鉴菜单', '', '🍽️', '4', 'bkk-le-du'),
  ('nightlife', '屋顶酒吧看日落', '日落前到。Lebua 这类屋顶酒吧', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Last_Light_%28222204615%29.jpeg/960px-Last_Light_%28222204615%29.jpeg', '🌅', '5', 'bkk-rooftop'),
  ('nightlife', 'Saxophone Pub 爵士乐', 'Victory Monument 附近，现场爵士', '', '🎷', '6', 'bkk-saxophone'),
  ('nightlife', 'Sukhumvit Soi 11 pub crawl', '一条巷子喝过去，量力而行', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Sukhumvit%2C_Bangkok_at_night.jpg/960px-Sukhumvit%2C_Bangkok_at_night.jpg', '🍻', '7', 'bkk-soi-11'),
  ('nightlife', 'Thonglor/Ekkamai 酒吧', '看当天心情，两边挑一边', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ekkamai_road.jpg/960px-Ekkamai_road.jpg', '🍸', '8', 'bkk-thonglor'),
  ('culture', '大皇宫', '早上去，门票 ฿500，遮住肩膀和膝盖', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Grand_Palace_Bangkok_1.jpg/960px-Grand_Palace_Bangkok_1.jpg', '🏯', '9', 'bkk-grand-palace'),
  ('culture', '卧佛寺 Wat Pho + 泰式按摩', '看卧佛，院里泰式按摩约 ฿300', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Wat_Pho_Reclining_Buddha.jpg/960px-Wat_Pho_Reclining_Buddha.jpg', '🛕', '10', 'bkk-wat-pho'),
  ('experience', '湄南河船 / 运河 khlong', '快船或长尾船，进运河看看', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Bangkok_river_boat_taxi%2C_Khlong_Saen_Saep%2C_Bangkok%2C_Thailand.jpg/960px-Bangkok_river_boat_taxi%2C_Khlong_Saen_Saep%2C_Bangkok%2C_Thailand.jpg', '🚤', '11', 'bkk-khlong'),
  ('experience', 'Rajadamnern 泰拳', '周六有赛，提前买票', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Rajadamnern_Stadium_2.jpg/960px-Rajadamnern_Stadium_2.jpg', '🥊', '12', 'bkk-rajadamnern'),
  ('experience', '泰菜烹饪课', '半天，学两道回去能做的', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Thai-Cooking-Class-Chiang-Mai-Thailand.jpg/960px-Thai-Cooking-Class-Chiang-Mai-Thailand.jpg', '👩‍🍳', '13', 'bkk-cooking'),
  ('experience', '美功铁道市场 + 安帕瓦水上市场', '周五合适，火车过摊再转水上市场', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Maeklong_Railway_Market_01.jpg/960px-Maeklong_Railway_Market_01.jpg', '🚂', '14', 'bkk-maeklong'),
  ('daily', 'Chatuchak 周末市场', '周六日上午，带现金', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Chatuchak_weekend_market_roofs.jpg/960px-Chatuchak_weekend_market_roofs.jpg', '🛍️', '15', 'bkk-chatuchak'),
  ('culture', 'Jim Thompson 之家', '丝绸老宅，中午室内凉快', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Jim_Thompson_House_Bangkok_P1110317.JPG/960px-Jim_Thompson_House_Bangkok_P1110317.JPG', '🏡', '16', 'bkk-jim-thompson'),
  ('daily', 'Talat Noi 街区漫步', '老街区，涂鸦和铁皮店', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Talat_Noi_Street_Art.jpg/960px-Talat_Noi_Street_Art.jpg', '🚶', '17', 'bkk-talat-noi'),
  ('daily', 'Bang Krachao 骑行', '绿肺，租自行车绕一圈', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Bang_Krachao_2.jpg/960px-Bang_Krachao_2.jpg', '🚲', '18', 'bkk-bang-krachao'),
  ('experience', '大城 Ayutthaya 一日游', '当天往返', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Wat_Chai_Watthanaram_-_Ayutthaya.jpg/960px-Wat_Chai_Watthanaram_-_Ayutthaya.jpg', '🏛️', '19', 'bkk-ayutthaya')
) as v(category, title, note, image_url, emoji, sort_order, seed_key)
where p.seed_key = 'bangkok-2026-10'
  and not exists (select 1 from explore_plan_items i where i.seed_key = v.seed_key);
