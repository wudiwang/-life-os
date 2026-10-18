import { useEffect } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { bindPageHistory, useUIStore } from './store/useUIStore'
import { PAGES } from './pages/registry'

export default function App() {
  useEffect(bindPageHistory, [])
  const currentPage = useUIStore(s => s.currentPage)
  const Page = PAGES[currentPage] || PAGES.dashboard
  return (
    <MainLayout>
      <Page />
    </MainLayout>
  )
}
