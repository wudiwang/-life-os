import { create } from 'zustand'

// 深链接：TG 键盘按钮/外部链接用 ?page=health 直接落到指定页。
// 非法值不用在这里校验——App.jsx 的 PAGES[x] || PAGES.dashboard 已经兜底。
function initialPage() {
  try {
    return new URLSearchParams(window.location.search).get('page') || 'dashboard'
  } catch {
    return 'dashboard'
  }
}

export const useUIStore = create(set => ({
  currentPage: initialPage(),
  setPage: page => set(state => {
    if (page === state.currentPage) return state
    // Keep the query synchronized for subsequent navigation as well, so history
    // never restores a stale module. Hashes belong only to their current page.
    const url = new URL(window.location.href)
    url.searchParams.set('page', page)
    url.hash = ''
    window.history.replaceState(null, '', url.href)
    return { currentPage: page }
  }),
  toast: null,
  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type, ts: Date.now() } })
    setTimeout(() => set(s => (s.toast && Date.now() - s.toast.ts >= 2900 ? { toast: null } : {})), 3000)
  },
}))

// Lesson hashes create browser history entries. Keep the app shell in sync when
// Back/Forward crosses a module boundary; replaceState itself emits no event.
export function bindPageHistory() {
  const navigate = () => useUIStore.setState({ currentPage: initialPage() })
  window.addEventListener('popstate', navigate)
  return () => window.removeEventListener('popstate', navigate)
}
