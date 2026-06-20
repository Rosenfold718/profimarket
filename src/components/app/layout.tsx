'use client'
import { useAppStore } from '@/stores/use-app-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Briefcase, FileText, MessageSquare, User, Users, Menu, LogOut,
  PlusCircle, ChevronRight, X, Building2, ClipboardList, UserCircle, Shield
} from 'lucide-react'
import { type View } from '@/stores/use-app-store'

const navItems: Array<{ view: View; label: string; icon: React.ReactNode; roles?: string[]; badge?: boolean }> = [
  { view: 'dashboard', label: 'Панель управления', icon: <LayoutDashboard className="w-5 h-5" /> },
  { view: 'orders', label: 'Каталог заказов', icon: <Briefcase className="w-5 h-5" /> },
  { view: 'chats', label: 'Чаты', icon: <MessageSquare className="w-5 h-5" />, badge: true },
  { view: 'my-orders', label: 'Мои заказы', icon: <FileText className="w-5 h-5" />, roles: ['CLIENT'] },
  { view: 'my-responses', label: 'Мои отклики', icon: <ClipboardList className="w-5 h-5" />, roles: ['EXECUTOR'] },
  { view: 'users', label: 'Исполнители', icon: <Users className="w-5 h-5" /> },
  { view: 'clients', label: 'Заказчики', icon: <UserCircle className="w-5 h-5" /> },
  { view: 'profile-edit', label: 'Мой профиль', icon: <User className="w-5 h-5" /> },
  { view: 'admin', label: 'Админ-панель', icon: <Shield className="w-5 h-5" />, roles: ['ADMIN'] },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, view, setView, logout, setSidebarOpen, unreadChats } = useAppStore()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 px-5 flex items-center border-b border-border shrink-0">
        <button onClick={() => { setView('dashboard'); onNavigate?.() }} className="flex items-center gap-3 hover:opacity-70 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight font-[family-name:var(--font-display)]">ProfiMarket</span>
        </button>
      </div>

      {/* User info */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3.5 px-3 py-3 rounded-xl bg-muted/50">
          <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-base overflow-hidden shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0) || '?'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.role === 'ADMIN' ? 'Администратор' : user?.role === 'CLIENT' ? 'Заказчик' : 'Исполнитель'}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-1">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role || ''))
            .map((item) => (
              <button
                key={item.view}
                onClick={() => { setView(item.view); setSidebarOpen(false); onNavigate?.() }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  view === item.view
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && unreadChats > 0 && (
                  <span className="min-w-[22px] h-[22px] rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center px-1.5">
                    {unreadChats}
                  </span>
                )}
                {view === item.view && <ChevronRight className="w-4 h-4 text-accent" />}
              </button>
            ))}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Bottom actions */}
      <div className="px-3 py-4 space-y-2">
        {user?.role === 'CLIENT' && (
          <Button
            onClick={() => { setView('create-order'); setSidebarOpen(false); onNavigate?.() }}
            className="w-full justify-start gap-2.5"
            size="sm"
          >
            <PlusCircle className="w-4 h-4" />
            Создать заказ
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => { logout(); setSidebarOpen(false); onNavigate?.() }}
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive"
          size="sm"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </Button>
      </div>
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:border-r lg:border-border bg-card h-screen sticky top-0">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SidebarContent onNavigate={() => setSidebarOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

const breadcrumbMap: Record<string, string[]> = {
  orders: ['Каталог заказов'],
  'order-detail': ['Каталог заказов', 'Детали заказа'],
  chats: ['Чаты'],
  'my-orders': ['Мои заказы'],
  'my-responses': ['Мои отклики'],
  users: ['Исполнители'],
  clients: ['Заказчики'],
  'profile-edit': ['Мой профиль'],
  'profile-view': ['Профиль'],
  'admin': ['Админ-панель'],
}

export function AppHeader() {
  const { user, view, setSidebarOpen } = useAppStore()

  if (!user || view === 'landing' || view === 'auth' || view === 'chats') return null

  const breadcrumbs = breadcrumbMap[view] || []

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md">
      <div className="flex items-center h-14 px-4 lg:px-6 gap-3 border-b border-border">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
              <span className={i === breadcrumbs.length - 1 ? 'font-semibold text-foreground truncate' : 'text-muted-foreground truncate'}>
                {crumb}
              </span>
            </span>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Profile avatar */}
        <button
          onClick={() => useAppStore.getState().setView('profile-edit')}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm hover:opacity-80 transition-opacity overflow-hidden shrink-0"
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            user.name?.charAt(0) || '?'
          )}
        </button>
      </div>
    </header>
  )
}

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className={`px-5 py-3.5 rounded-xl shadow-lg border flex items-center gap-3 max-w-sm text-sm ${
              t.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300' :
              t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' :
              'bg-muted border-border text-foreground'
            }`}
          >
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-auto opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}