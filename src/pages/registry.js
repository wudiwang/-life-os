// 页面注册表：App.jsx 据此切换页面。新增页面在此登记。
import { PlaceholderPage } from './Placeholder'
import { HealthPage } from './Health/HealthPage'
import { HabitsPage } from './Habits/HabitsPage'
import { GoalsPage } from './Goals/GoalsPage'

export const PAGES = {
  dashboard: PlaceholderPage,
  journal: PlaceholderPage,
  health: HealthPage,
  habits: HabitsPage,
  goals: GoalsPage,
  work: PlaceholderPage,
  explore: PlaceholderPage,
  knowledge: PlaceholderPage,
  relations: PlaceholderPage,
  ai: PlaceholderPage,
  settings: PlaceholderPage,
}
