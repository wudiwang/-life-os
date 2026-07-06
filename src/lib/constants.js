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
]
