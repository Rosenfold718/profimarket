import { create } from 'zustand'

export type View = 'landing' | 'auth' | 'dashboard' | 'orders' | 'order-detail' | 'chats' | 'profile-view' | 'profile-edit' | 'users' | 'my-orders' | 'my-responses'

interface User {
  id: string
  email: string
  name: string
  role: 'CLIENT' | 'EXECUTOR'
  phone?: string
  avatar?: string
  profile?: {
    id: string
    company?: string
    position?: string
    experienceYears?: number
    specializations?: string
    description?: string
    region?: string
    city?: string
    education?: string
    certificates?: string
    rating: number
    completedOrders: number
    website?: string
    socialLinks?: string
  } | null
}

interface AppState {
  // Navigation
  view: View
  setView: (v: View) => void
  navigateToOrder: (id: string, tab?: string) => void
  selectedOrderId: string | null
  selectedOrderTab: string
  navigateToProfile: (id: string) => void
  selectedProfileId: string | null

  // Auth
  user: User | null
  token: string | null
  setUser: (u: User | null, t?: string | null) => void
  logout: () => void
  isLoadingAuth: boolean
  setIsLoadingAuth: (v: boolean) => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  unreadChats: number
  setUnreadChats: (n: number) => void
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'landing',
  setView: (v) => set({ view: v }),
  navigateToOrder: (id, tab) => set({ selectedOrderId: id, selectedOrderTab: tab || 'info', view: 'order-detail' }),
  selectedOrderId: null,
  selectedOrderTab: 'info',
  navigateToProfile: (id) => set({ selectedProfileId: id, view: 'profile-view' }),
  selectedProfileId: null,

  user: null,
  token: typeof localStorage !== 'undefined' ? localStorage.getItem('pm_token') : null,
  setUser: (u, t) => {
    const update: Record<string, unknown> = { user: u }
    if (t !== undefined) {
      update.token = t
      if (typeof localStorage !== 'undefined') {
        if (t) localStorage.setItem('pm_token', t)
        else localStorage.removeItem('pm_token')
      }
    }
    return set(update)
  },
  logout: () => {
    if (typeof document !== 'undefined') document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    if (typeof localStorage !== 'undefined') localStorage.removeItem('pm_token')
    set({ user: null, token: null, view: 'landing', unreadChats: 0 })
  },
  isLoadingAuth: true,
  setIsLoadingAuth: (v) => set({ isLoadingAuth: v }),

  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  unreadChats: 0,
  setUnreadChats: (n) => set({ unreadChats: n }),

  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
