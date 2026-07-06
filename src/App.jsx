import { MainLayout } from './components/layout/MainLayout'
import { useUIStore } from './store/useUIStore'
import { PAGES } from './pages/registry'

export default function App() {
  const currentPage = useUIStore(s => s.currentPage)
  const Page = PAGES[currentPage] || PAGES.dashboard
  return (
    <MainLayout>
      <Page />
    </MainLayout>
  )
}
