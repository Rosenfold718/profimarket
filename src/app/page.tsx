'use client'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { LandingView } from '@/views/landing'
import { AuthView } from '@/views/auth'
import { DashboardView } from '@/views/dashboard'
import { OrdersView } from '@/views/orders'
import { OrderDetailView } from '@/views/order-detail'
import { ChatsView } from '@/views/chats'
import { ProfileView } from '@/views/profile-view'
import { ProfileEditView } from '@/views/profile-edit'
import { UsersView } from '@/views/users'
import { ClientsView } from '@/views/clients'
import { MyOrdersView } from '@/views/my-orders'
import { MyResponsesView } from '@/views/my-responses'
import { CreateOrderView } from '@/views/create-order'
import { AdminView } from '@/views/admin'
import { AppSidebar, AppHeader, MobileSidebar, ToastContainer } from '@/components/app/layout'

function AppShell({ children, noScroll }: { children: React.ReactNode; noScroll?: boolean }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <MobileSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />
        <main className={`flex-1 ${noScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

export default function Page() {
  const view = useAppStore((s) => s.view)
  const user = useAppStore((s) => s.user)
  const isLoadingAuth = useAppStore((s) => s.isLoadingAuth)
  const setUser = useAppStore((s) => s.setUser)
  const setIsLoadingAuth = useAppStore((s) => s.setIsLoadingAuth)

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const state = window.history.state
      if (state?.view) {
        useAppStore.getState().setView(state.view)
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Push browser history on view change (skip initial load)
  useEffect(() => {
    if (view !== 'landing') {
      window.history.pushState({ view }, '')
    }
  }, [view])

  // Heartbeat for online status (every 30s when authenticated)
  useEffect(() => {
    if (!user) return
    const sendHeartbeat = () => {
      fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${useAppStore.getState().token}` },
      }).catch(() => {})
    }
    sendHeartbeat()
    const timer = setInterval(sendHeartbeat, 30_000)
    return () => clearInterval(timer)
  }, [user])

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await authFetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUser(data.user, data.token || null)
          if (useAppStore.getState().view === 'landing') {
            useAppStore.getState().setView('dashboard')
          }
        } else {
          setUser(null, null)
        }
      } catch {
        setUser(null, null)
      } finally {
        setIsLoadingAuth(false)
      }
    }
    checkAuth()
  }, [])

  // Loading screen
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-primary-foreground animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-80" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  // Public views
  if (view === 'landing') return <LandingView />
  if (view === 'auth') return <AuthView />

  // Protected views (require auth)
  if (!user) return <LandingView />

  const viewMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardView />,
    orders: <OrdersView />,
    'order-detail': <OrderDetailView />,
    chats: <ChatsView />,
    'profile-view': <ProfileView />,
    'profile-edit': <ProfileEditView />,
    users: <UsersView />,
    clients: <ClientsView />,
    'my-orders': <MyOrdersView />,
    'my-responses': <MyResponsesView />,
    'create-order': <CreateOrderView />,
    admin: <AdminView />,
  }

  return <AppShell noScroll={view === 'chats'}>{viewMap[view] || <DashboardView />}</AppShell>
}
