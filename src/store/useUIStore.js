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
  setPage: page => set({ currentPage: page }),
  toast: null,
  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type, ts: Date.now() } })
    setTimeout(() => set(s => (s.toast && Date.now() - s.toast.ts >= 2900 ? { toast: null } : {})), 3000)
  },
}))
