'use client'

import { useEffect, useState, useCallback } from 'react'
import { authFetch } from '@/lib/fetch'
import { useAppStore } from '@/stores/use-app-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Users, Briefcase, MessageSquare, MessageCircle, Trash2, Search, Shield,
  Clock, CheckCircle2, XCircle, Loader2, FileText, UserPlus, BarChart3
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Stats {
  users: { total: number; clients: number; executors: number; admins: number }
  orders: { total: number; open: number; inProgress: number; completed: number; cancelled: number }
  messages: { total: number }
  responses: { total: number }
  conversations: { total: number }
}

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  avatar: string | null
  createdAt: string
}

interface OrderRow {
  id: string
  title: string
  status: string
  clientId: string
  executorId: string | null
  budgetFrom: number | null
  budgetTo: number | null
  region: string | null
  city: string | null
  createdAt: string
  clientName: string
  executorName: string | null
}

const roleBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ADMIN: { label: 'Админ', variant: 'destructive' },
  CLIENT: { label: 'Заказчик', variant: 'default' },
  EXECUTOR: { label: 'Исполнитель', variant: 'secondary' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Открыт', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  IN_PROGRESS: { label: 'В работе', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: 'Выполнен', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: 'Отменён', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function DeleteConfirmButton({ onConfirm, label, description }: {
  onConfirm: () => void; label: string; description: string
}) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AdminView() {
  const { addToast } = useAppStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [usersList, setUsersList] = useState<UserRow[]>([])
  const [ordersList, setOrdersList] = useState<OrderRow[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userTotalPages, setUserTotalPages] = useState(1)
  const [orderPage, setOrderPage] = useState(1)
  const [orderTotalPages, setOrderTotalPages] = useState(1)

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin')
      if (res.status === 403) {
        addToast('Доступ запрещён', 'error')
        return
      }
      const data = await res.json()
      setStats(data)
    } catch {
      addToast('Ошибка загрузки статистики', 'error')
    } finally {
      setLoadingStats(false)
    }
  }, [addToast])

  const fetchUsers = useCallback(async (page: number, search: string) => {
    setLoadingUsers(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const res = await authFetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsersList(data.users)
      setUserTotalPages(data.pagination.totalPages)
    } catch {
      addToast('Ошибка загрузки пользователей', 'error')
    } finally {
      setLoadingUsers(false)
    }
  }, [addToast])

  const fetchOrders = useCallback(async (page: number) => {
    setLoadingOrders(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      const res = await authFetch(`/api/admin/orders?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOrdersList(data.orders)
      setOrderTotalPages(data.pagination.totalPages)
    } catch {
      addToast('Ошибка загрузки заказов', 'error')
    } finally {
      setLoadingOrders(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchStats()
    fetchUsers(1, '')
    fetchOrders(1)
  }, [fetchStats, fetchUsers, fetchOrders])

  const handleSearchUsers = () => {
    setUserPage(1)
    fetchUsers(1, userSearch)
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        addToast(data.error || 'Ошибка удаления', 'error')
        return
      }
      addToast(`Пользователь "${userName}" удалён`, 'success')
      fetchStats()
      fetchUsers(userPage, userSearch)
    } catch {
      addToast('Ошибка удаления пользователя', 'error')
    }
  }

  const handleDeleteOrder = async (orderId: string, orderTitle: string) => {
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        addToast(data.error || 'Ошибка удаления', 'error')
        return
      }
      addToast(`Заказ "${orderTitle}" удалён`, 'success')
      fetchStats()
      fetchOrders(orderPage)
    } catch {
      addToast('Ошибка удаления заказа', 'error')
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy, HH:mm', { locale: ru })
    } catch {
      return dateStr
    }
  }

  const formatBudget = (from: number | null, to: number | null) => {
    if (!from && !to) return '—'
    const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n)
    if (from && to) return `${fmt(from)} – ${fmt(to)} ₽`
    if (from) return `от ${fmt(from)} ₽`
    return `до ${fmt(to)} ₽`
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Админ-панель</h1>
          <p className="text-sm text-muted-foreground">Управление платформой ProfiMarket</p>
        </div>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Всего пользователей"
            value={stats.users.total}
            sub={`Заказчики: ${stats.users.clients} · Исполнители: ${stats.users.executors}`}
            color="bg-violet-500"
          />
          <StatCard
            icon={UserPlus}
            label="Заказчики"
            value={stats.users.clients}
            color="bg-blue-500"
          />
          <StatCard
            icon={Users}
            label="Исполнители"
            value={stats.users.executors}
            color="bg-emerald-500"
          />
          <StatCard
            icon={Briefcase}
            label="Всего заказов"
            value={stats.orders.total}
            sub={`Открытых: ${stats.orders.open} · В работе: ${stats.orders.inProgress}`}
            color="bg-amber-500"
          />
          <StatCard
            icon={Clock}
            label="Открытых заказов"
            value={stats.orders.open}
            color="bg-sky-500"
          />
          <StatCard
            icon={CheckCircle2}
            label="Выполненных"
            value={stats.orders.completed}
            color="bg-green-500"
          />
          <StatCard
            icon={MessageSquare}
            label="Сообщений"
            value={stats.messages.total}
            color="bg-pink-500"
          />
          <StatCard
            icon={MessageCircle}
            label="Диалогов"
            value={stats.conversations.total}
            color="bg-orange-500"
          />
        </div>
      ) : null}

      {/* Tabs: Users / Orders */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Пользователи
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <FileText className="w-4 h-4" />
            Заказы
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени или email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearchUsers} variant="secondary">
              Найти
            </Button>
          </div>

          {/* Users table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[480px] overflow-y-auto">
                {loadingUsers ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : usersList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Пользователи не найдены</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Имя</TableHead>
                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead className="hidden md:table-cell">Дата регистрации</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersList.map((u) => {
                        const rb = roleBadgeMap[u.role] || { label: u.role, variant: 'outline' as const }
                        return (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 overflow-hidden">
                                  {u.avatar ? (
                                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    u.name.charAt(0)
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate text-sm">{u.name}</p>
                                  <p className="text-xs text-muted-foreground sm:hidden truncate">{u.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              <Badge variant={rb.variant}>{rb.label}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {formatDate(u.createdAt)}
                            </TableCell>
                            <TableCell>
                              <DeleteConfirmButton
                                onConfirm={() => handleDeleteUser(u.id, u.name)}
                                label={u.name}
                                description={`Вы уверены, что хотите удалить пользователя "${u.name}" (${u.email})? Все связанные данные (профиль, заказы, сообщения) будут удалены безвозвратно.`}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {userTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={userPage <= 1}
                onClick={() => { const p = userPage - 1; setUserPage(p); fetchUsers(p, userSearch) }}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                {userPage} / {userTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={userPage >= userTotalPages}
                onClick={() => { const p = userPage + 1; setUserPage(p); fetchUsers(p, userSearch) }}
              >
                Далее
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[480px] overflow-y-auto">
                {loadingOrders ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : ordersList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Заказы не найдены</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Заголовок</TableHead>
                        <TableHead className="hidden lg:table-cell">Заказчик</TableHead>
                        <TableHead className="hidden md:table-cell">Исполнитель</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="hidden sm:table-cell">Бюджет</TableHead>
                        <TableHead className="hidden lg:table-cell">Дата</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersList.map((o) => {
                        const sc = statusConfig[o.status] || { label: o.status, color: '' }
                        return (
                          <TableRow key={o.id}>
                            <TableCell>
                              <p className="font-medium truncate text-sm max-w-[200px]">{o.title}</p>
                              {(o.region || o.city) && (
                                <p className="text-xs text-muted-foreground">{[o.region, o.city].filter(Boolean).join(', ')}</p>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{o.clientName}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {o.executorName || <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${sc.color}`}>
                                {sc.label}
                              </span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">
                              {formatBudget(o.budgetFrom, o.budgetTo)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {formatDate(o.createdAt)}
                            </TableCell>
                            <TableCell>
                              <DeleteConfirmButton
                                onConfirm={() => handleDeleteOrder(o.id, o.title)}
                                label={o.title}
                                description={`Вы уверены, что хотите удалить заказ "${o.title}"? Все отклики и сообщения в рамках этого заказа будут удалены безвозвратно.`}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {orderTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={orderPage <= 1}
                onClick={() => { const p = orderPage - 1; setOrderPage(p); fetchOrders(p) }}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                {orderPage} / {orderTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={orderPage >= orderTotalPages}
                onClick={() => { const p = orderPage + 1; setOrderPage(p); fetchOrders(p) }}
              >
                Далее
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}