// 全局常量：模块导航、色板

export const COLORS = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  green: '#10B981',
  red: '#EF4444',
  orange: '#F59E0B',
  purple: '#8B5CF6',
  pink: '#EC4899',
  teal: '#14B8A6',
  gray: '#6B7280',
  bg: '#F3F4F6',
  card: '#FFFFFF',
  border: '#E5E7EB',
  text: '#1F2937',
  textLight: '#6B7280',
}

export const NAV_ITEMS = [
  { key: 'dashboard', label: '人生看板', icon: '🏠' },
  { key: 'journal', label: '每日一记', icon: '📔' },
  { key: 'health', label: '健康', icon: '❤️' },
  { key: 'habits', label: '习惯', icon: '🔁' },
  { key: 'goals', label: '目标', icon: '🎯' },
  { key: 'work', label: '工作', icon: '💼' },
  { key: 'explore', label: '探索世界', icon: '🧭' },
  { key: 'knowledge', label: '第二大脑', icon: '🧠' },
  { key: 'relations', label: '情感关系', icon: '💞' },
  { key: 'ai', label: 'AI 分析', icon: '🤖' },
  { key: 'settings', label: '设置', icon: '⚙️' },
]

export const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(i => [i.key, `${i.icon} ${i.label}`]))

// 健康指标类型定义
export const METRIC_TYPES = [
  { key: 'weight', label: '体重', unit: 'kg', dual: false },
  { key: 'height', label: '身高', unit: 'cm', dual: false },
  { key: 'blood_pressure', label: '血压', unit: 'mmHg', dual: true, labels: ['收缩压', '舒张压'] },
  { key: 'heart_rate', label: '静息心率', unit: 'bpm', dual: false },
  { key: 'blood_sugar', label: '空腹血糖', unit: 'mmol/L', dual: false },
  { key: 'body_fat', label: '体脂率', unit: '%', dual: false },
  { key: 'sleep_hours', label: '睡眠时长', unit: 'h', dual: false },
  { key: 'custom', label: '自定义', unit: '', dual: false },
]

// 体成分（InBody）指标定义。key 优先匹配 metric_type，其次匹配 custom 的 metric_name。
// good: 'down' 表示数值降低是好事，'up' 反之——用于对比表的涨跌配色。
export const BODY_METRICS = [
  { key: 'body_fat', name: '体脂率', unit: '%', good: 'down', ref: '成年男性 15–20%', core: true },
  { key: '内脏脂肪等级', name: '内脏脂肪等级', unit: 'Lv', good: 'down', ref: '≤ 9', core: true },
  { key: '肌肉量', name: '肌肉量', unit: 'kg', good: 'up', core: true },
  { key: 'weight', name: '体重', unit: 'kg', good: 'down', core: true },
  { key: '脂肪量', name: '脂肪量', unit: 'kg', good: 'down' },
  { key: 'BMI', name: 'BMI', unit: '', good: 'down', ref: '18.5–24' },
  { key: '腰臀比', name: '腰臀比', unit: '', good: 'down', ref: '男性 ≤ 0.90' },
  { key: '身体年龄', name: '身体年龄', unit: '岁', good: 'down', ref: '低于实际年龄为佳' },
  { key: '基础代谢', name: '基础代谢', unit: 'kcal', good: 'up' },
  { key: 'InBody评分', name: 'InBody 评分', unit: '分', good: 'up', ref: '80 分以上为佳' },
]

// 血液检查组套。参考区间为常见成年男性范围，仅作提示——一切以报告单标注为准。
export const BLOOD_PANEL = [
  { group: '血脂', key: 'TC', name: '总胆固醇', unit: 'mmol/L', low: 2.8, high: 5.2 },
  { group: '血脂', key: 'TG', name: '甘油三酯', unit: 'mmol/L', low: 0.4, high: 1.7 },
  { group: '血脂', key: 'HDL', name: '高密度脂蛋白', unit: 'mmol/L', low: 1.0, high: 2.0, good: 'up' },
  { group: '血脂', key: 'LDL', name: '低密度脂蛋白', unit: 'mmol/L', low: 0, high: 3.4 },
  { group: '血糖', key: 'GLU', name: '空腹血糖', unit: 'mmol/L', low: 3.9, high: 6.1 },
  { group: '血糖', key: 'HBA1C', name: '糖化血红蛋白', unit: '%', low: 4.0, high: 6.0 },
  { group: '肝功能', key: 'ALT', name: '谷丙转氨酶 ALT', unit: 'U/L', low: 9, high: 50 },
  { group: '肝功能', key: 'AST', name: '谷草转氨酶 AST', unit: 'U/L', low: 15, high: 40 },
  { group: '肝功能', key: 'GGT', name: '谷氨酰转肽酶 GGT', unit: 'U/L', low: 10, high: 60 },
  { group: '肝功能', key: 'TBIL', name: '总胆红素', unit: 'μmol/L', low: 3.4, high: 20.5 },
  { group: '肾功能', key: 'UA', name: '尿酸', unit: 'μmol/L', low: 208, high: 428 },
  { group: '肾功能', key: 'CR', name: '肌酐', unit: 'μmol/L', low: 57, high: 111 },
  { group: '肾功能', key: 'BUN', name: '尿素氮', unit: 'mmol/L', low: 3.1, high: 8.0 },
  { group: '血常规', key: 'WBC', name: '白细胞', unit: '10⁹/L', low: 3.5, high: 9.5 },
  { group: '血常规', key: 'HGB', name: '血红蛋白', unit: 'g/L', low: 130, high: 175 },
  { group: '血常规', key: 'PLT', name: '血小板', unit: '10⁹/L', low: 125, high: 350 },
  { group: '其他', key: 'TSH', name: '促甲状腺激素', unit: 'mIU/L', low: 0.27, high: 4.2 },
  { group: '其他', key: 'HCY', name: '同型半胱氨酸', unit: 'μmol/L', low: 0, high: 15 },
]

export const GOAL_LEVELS = [
  { key: 'year', label: '年度', color: COLORS.purple },
  { key: 'quarter', label: '季度', color: COLORS.teal },
  { key: 'month', label: '月度', color: COLORS.primary },
  { key: 'short', label: '短期', color: COLORS.orange },
]

export const GOAL_STATUS = [
  { key: 'planning', label: '规划中', color: COLORS.gray },
  { key: 'active', label: '进行中', color: COLORS.primary },
  { key: 'done', label: '已完成', color: COLORS.green },
  { key: 'dropped', label: '已放弃', color: COLORS.red },
]

export const MILESTONE_STATUS = [
  { key: 'pending', label: '待检查', color: COLORS.gray },
  { key: 'passed', label: '达成', color: COLORS.green },
  { key: 'partial', label: '部分达成', color: COLORS.orange },
  { key: 'failed', label: '未达成', color: COLORS.red },
]

export const TODO_PRIORITIES = [
  { key: 'high', label: '高', color: COLORS.red },
  { key: 'mid', label: '中', color: COLORS.orange },
  { key: 'low', label: '低', color: COLORS.gray },
]

export const EXPLORE_CATEGORIES = [
  { key: 'food', label: '美食', icon: '🍜' },
  { key: 'travel', label: '旅行', icon: '✈️' },
  { key: 'experience', label: '经历', icon: '🎬' },
  { key: 'insight', label: '认知', icon: '💡' },
  { key: 'other', label: '其他', icon: '📌' },
]

export const REL_TYPES = [
  { key: 'family', label: '亲情', icon: '👨‍👩‍👧', color: COLORS.orange },
  { key: 'friend', label: '友情', icon: '🤝', color: COLORS.teal },
  { key: 'love', label: '爱情', icon: '💗', color: COLORS.pink },
]

// 每日三向：每天必须投入思考的固定方向，看板首屏打卡（表 daily_focus）
// prompts 是打卡弹窗里的自问清单——方向固定，问题才不会每天重新想。
export const FOCUS_TRACKS = [
  {
    key: 'work', label: '工作 · 职责边界', short: '工作', icon: '💼', color: COLORS.primary,
    hint: '今天我的边界在哪？该我扛的扛了吗，不该我接的接了吗？',
    prompts: [
      '边界：今天有没有越界，或者被别人越界？',
      '产出：我这个位置今天真正推动了什么？',
      '取舍：明天该放掉哪件不属于我的事？',
    ],
  },
  {
    key: 'trade', label: '交易', short: '交易', icon: '📈', color: COLORS.orange,
    hint: '今天怎么看市场？做了什么决策，纪律守住了吗？',
    prompts: [
      '判断：现在的仓位背后是什么逻辑？还成立吗？',
      '纪律：今天有没有情绪化的动作（追高、扛单、乱加仓）？',
      '复盘：今天最该记住的一条教训是什么？',
    ],
  },
  {
    key: 'life', label: '生活健康', short: '生活', icon: '🌱', color: COLORS.green,
    hint: '健身、饮食、人际关系——今天做到了什么？',
    prompts: [
      '身体：练了吗？吃得怎么样？睡够了吗？',
      '关系：今天和谁的连接变深了，或者欠了谁一个回应？',
      '状态：今天的精力是被什么消耗掉的？',
    ],
  },
]

export const MOODS = [
  { value: 1, icon: '😞', label: '很差' },
  { value: 2, icon: '😕', label: '不佳' },
  { value: 3, icon: '😐', label: '一般' },
  { value: 4, icon: '🙂', label: '不错' },
  { value: 5, icon: '😄', label: '很好' },
]

// 数据表清单（导出备份用）
export const ALL_TABLES = [
  'health_metrics', 'health_reports', 'habits', 'habit_logs',
  'goals', 'goal_milestones', 'goal_logs',
  'work_todos', 'work_logs', 'work_profile', 'work_contacts',
  'explore_records', 'knowledge_notes',
  'relation_people', 'relation_logs',
  'journal_entries', 'ai_reviews', 'life_stage',
  'ai_jobs', 'blood_metrics', 'daily_focus',
]
