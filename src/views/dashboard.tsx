'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import {
  Briefcase, FileText, ClipboardList, Users, PlusCircle, ArrowRight,
  MapPin, Star, MessageSquare, CheckCircle2
} from 'lucide-react'

// Helper: get first name from Russian "Фамилия Имя Отчество" format
function getFirstName(fullName: string | undefined): string {
  if (!fullName) return 'специалист'
  const parts = fullName.split(' ')
  // In Russian naming: Фамилия Имя Отчество — index 1 is the first name
  return parts.length > 1 ? parts[1] : parts[0]
}

interface Order {
  id: string
  title: string
  description: string
  status: string
  budgetFrom?: number
  budgetTo?: number
  region?: string
  city?: string
  createdAt: string
  _count: { responses: number; messages: number }
  category?: { name: string } | null
  client?: { id: string; name: string; role: string } | null
}

interface ChatPreview {
  orderId: string
  title: string
  lastMessage: string
  lastTime: string
  unread: number
  interlocutorName: string
}

export function DashboardView() {
  const { user, setView, navigateToOrder, addToast, setUnreadChats } = useAppStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({ openOrders: 0, myActive: 0, totalExecutors: 0 })
  const [loading, setLoading] = useState(true)
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes, usersRes, chatsRes] = await Promise.all([
          fetch('/api/orders?limit=6'),
          fetch('/api/users?limit=1&role=EXECUTOR'),
          authFetch('/api/chats'),
        ])
        const ordersData = await ordersRes.json()
        const usersData = await usersRes.json()
        const chatsData = await chatsRes.json()

        setOrders(ordersData.orders || [])
        setStats({ openOrders: ordersData.total || 0, myActive: 0, totalExecutors: usersData.total || 0 })

        // Compute unread
        const chats = chatsData.chats || []
        const totalUnread = chats.reduce((sum: number, c: { unreadCount: number }) => sum + c.unreadCount, 0)
        setUnreadChats(totalUnread)

        // Build chat previews from real data
        const previews: ChatPreview[] = chats.slice(0, 4).map((c: { orderId: string; title: string; lastMessage: { content: string; createdAt: string }; unreadCount: number; interlocutor: { name: string } }) => ({
          orderId: c.orderId,
          title: c.title,
          lastMessage: c.lastMessage?.content || '',
          lastTime: c.lastMessage?.createdAt || '',
          unread: c.unreadCount,
          interlocutorName: c.interlocutor?.name || '',
        }))
        setChatPreviews(previews)
      } catch {
        addToast('Ошибка загрузки данных', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, addToast, setUnreadChats])

  const statusColor = (s: string) => {
    switch (s) {
      case 'OPEN': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
      case 'IN_PROGRESS': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
      case 'COMPLETED': return 'bg-muted text-muted-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const statusLabel = (s: string) => ({ OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' })[s] || s

  const formatBudget = (from?: number, to?: number) => {
    if (!from && !to) return 'Договорная'
    const f = from ? `${(from / 1000).toFixed(0)}K` : ''
    const t = to ? `${(to / 1000).toFixed(0)}K` : ''
    return `${f} — ${t} ₽`
  }

  const formatTime = (d: string) => {
    if (!d) return ''
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    if (mins < 1) return 'Сейчас'
    if (mins < 60) return `${mins} мин`
    if (hours < 24) return `${hours} ч`
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-5 lg:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-display)]">
            {user?.role === 'CLIENT' ? 'Добро пожаловать' : `Здравствуйте, ${getFirstName(user?.name)}`}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-base">
            {user?.role === 'CLIENT'
              ? 'Управляйте заказами и находите лучших исполнителей'
              : 'Находите подходящие заказы и откликайтесь на них'}
          </p>
        </div>
        {user?.role === 'CLIENT' && (
          <Button className="gap-2 h-10" onClick={() => setView('create-order')}>
            <PlusCircle className="w-4 h-4" />
            Создать заказ
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Открытых заказов', value: stats.openOrders, icon: <Briefcase className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: user?.role === 'CLIENT' ? 'Моих заказов' : 'Моих откликов', value: stats.myActive || 0, icon: user?.role === 'CLIENT' ? <FileText className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />, color: 'text-accent' },
          { label: 'Специалистов', value: stats.totalExecutors, icon: <Users className="w-5 h-5" />, color: 'text-foreground' },
          { label: 'Средний рейтинг', value: '4.9', icon: <Star className="w-5 h-5" />, color: 'text-yellow-500' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="border bg-card">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl bg-muted flex items-center justify-center ${s.color}`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold font-[family-name:var(--font-display)]">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-7">
        {/* Latest orders */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">
              {user?.role === 'EXECUTOR' ? 'Актуальные заказы' : 'Последние заказы'}
            </h3>
            <Button variant="ghost" onClick={() => setView('orders')} className="text-accent gap-1">
              Все <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2.5">
            {orders.slice(0, 5).map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="card-hover cursor-pointer border bg-card" onClick={() => navigateToOrder(order.id)}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <Badge variant="outline" className={`${statusColor(order.status)} text-xs`}>{statusLabel(order.status)}</Badge>
                          {order.category && <span className="text-sm text-muted-foreground">{order.category.name}</span>}
                        </div>
                        <h4 className="font-semibold text-base truncate">{order.title}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {order.city && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{order.city}</span>}
                          <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" />{order._count?.responses || 0} откликов</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-foreground">{formatBudget(order.budgetFrom, order.budgetTo)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Recent chats */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">Последние чаты</h3>
              <Button variant="ghost" onClick={() => setView('chats')} className="text-accent gap-1">
                Все <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <Card className="border bg-card">
              <CardContent className="p-0 divide-y divide-border">
                {chatPreviews.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Нет активных чатов</p>
                  </div>
                ) : (
                  chatPreviews.map((chat) => (
                    <button
                      key={chat.orderId}
                      onClick={() => navigateToOrder(chat.orderId, 'chat')}
                      className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 text-sm font-medium">
                        {chat.interlocutorName?.charAt(0) || <MessageSquare className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{chat.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.interlocutorName}: {chat.lastMessage}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="text-[11px] text-muted-foreground">{formatTime(chat.lastTime)}</span>
                        {chat.unread > 0 && (
                          <span className="min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <div>
            <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-3">Быстрые действия</h3>
            <Card className="border bg-card">
              <CardContent className="p-2 space-y-1">
                {user?.role === 'EXECUTOR' ? (
                  <>
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setView('orders')}>
                      <Briefcase className="w-4 h-4" />Найти заказы
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setView('my-responses')}>
                      <ClipboardList className="w-4 h-4" />Мои отклики
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setView('profile-edit')}>
                      <Star className="w-4 h-4" />Обновить профиль
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setView('create-order')}>
                      <PlusCircle className="w-4 h-4" />Создать заказ
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setView('my-orders')}>
                      <FileText className="w-4 h-4" />Мои заказы
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setView('users')}>
                      <Users className="w-4 h-4" />Найти исполнителя
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Profile card (for executors) */}
          {user?.role === 'EXECUTOR' && user.profile && (
            <Card className="border bg-card">
              <CardContent className="p-5">
                <h4 className="text-base font-bold mb-3 font-[family-name:var(--font-display)]">Ваш профиль</h4>
                <div className="space-y-2.5">
                  {user.profile.rating > 0 && (
                    <div className="flex items-center gap-2.5">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm">Рейтинг: {user.profile.rating}</span>
                    </div>
                  )}
                  {user.profile.completedOrders > 0 && (
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm">Выполнено: {user.profile.completedOrders} заказов</span>
                    </div>
                  )}
                  {user.profile.specializations && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {JSON.parse(user.profile.specializations).map((s: string, i: number) => (
                        <Badge key={i} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}