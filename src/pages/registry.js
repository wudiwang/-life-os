// 页面注册表：App.jsx 据此切换页面。新增页面在此登记。
import { PlaceholderPage } from './Placeholder'
import { HealthPage } from './Health/HealthPage'
import { HabitsPage } from './Habits/HabitsPage'
import { GoalsPage } from './Goals/GoalsPage'
import { WorkPage } from './Work/WorkPage'
import { ExplorePage } from './Explore/ExplorePage'
import { KnowledgePage } from './Knowledge/KnowledgePage'
import { RelationsPage } from './Relations/RelationsPage'
import { JournalPage } from './Journal/JournalPage'

export const PAGES = {
  dashboard: PlaceholderPage,
  journal: JournalPage,
  health: HealthPage,
  habits: HabitsPage,
  goals: GoalsPage,
  work: WorkPage,
  explore: ExplorePage,
  knowledge: KnowledgePage,
  relations: RelationsPage,
  ai: PlaceholderPage,
  settings: PlaceholderPage,
}
