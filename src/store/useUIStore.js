import { create } from 'zustand'

export const useUIStore = create(set => ({
  currentPage: 'dashboard',
  setPage: page => set({ currentPage: page }),
  toast: null,
  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type, ts: Date.now() } })
    setTimeout(() => set(s => (s.toast && Date.now() - s.toast.ts >= 2900 ? { toast: null } : {})), 3000)
  },
}))
