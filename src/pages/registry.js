// 页面注册表：App.jsx 据此切换页面。新增页面在此登记。
import { DashboardPage } from './Dashboard/DashboardPage'
import { DailyBoard } from './Dashboard/DailyBoard'
import { AIPage } from './AI/AIPage'
import { SettingsPage } from './Settings/SettingsPage'
import { HealthPage } from './Health/HealthPage'
import { HabitsPage } from './Habits/HabitsPage'
import { GoalsPage } from './Goals/GoalsPage'
import { WorkPage } from './Work/WorkPage'
import { ExplorePage } from './Explore/ExplorePage'
import { KnowledgePage } from './Knowledge/KnowledgePage'
import { RelationsPage } from './Relations/RelationsPage'
import { JournalPage } from './Journal/JournalPage'
import { OKRPage } from './OKR/OKRPage'
import { TradePatternsPage } from './TradePatterns/TradePatternsPage'
import { ThaiPage } from './Thai/ThaiPage'
import { MealPlanPage } from './MealPlan/MealPlanPage'

export const PAGES = {
  dashboard: DailyBoard,
  overview: DashboardPage,
  okr: OKRPage,
  journal: JournalPage,
  tradePatterns: TradePatternsPage,
  health: HealthPage,
  mealPlan: MealPlanPage,
  habits: HabitsPage,
  goals: GoalsPage,
  work: WorkPage,
  explore: ExplorePage,
  knowledge: KnowledgePage,
  thai: ThaiPage,
  relations: RelationsPage,
  ai: AIPage,
  settings: SettingsPage,
}
