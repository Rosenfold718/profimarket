'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import {
  Search, MapPin, MessageSquare, Clock, ChevronLeft, ChevronRight, SlidersHorizontal, Briefcase, AlertTriangle, FolderOpen, Loader, CheckCircle2
} from 'lucide-react'

interface Category { id: string; name: string; slug: string }
interface Order {
  id: string; title: string; description: string; status: string
  budgetFrom?: number; budgetTo?: number; region?: string; city?: string
  createdAt: string; deadline?: string
  _count: { responses: number; messages: number }
  category?: { name: string } | null
  client?: { id: string; name: string; role: string } | null
}

const statusColor = (s: string) => {
  switch (s) {
    case 'OPEN': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
    case 'IN_PROGRESS': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
    case 'COMPLETED': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
    case 'CANCELLED': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
    default: return 'bg-muted text-muted-foreground'
  }
}

const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }

const statusTabs = [
  { key: 'OPEN', label: 'Открытые', icon: <FolderOpen className="w-4 h-4" />, activeClass: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25', countClass: 'bg-white/20 text-white' },
  { key: 'IN_PROGRESS', label: 'В работе', icon: <Loader className="w-4 h-4" />, activeClass: 'bg-amber-600 text-white shadow-sm shadow-amber-600/25', countClass: 'bg-white/20 text-white' },
  { key: 'COMPLETED', label: 'Выполненные', icon: <CheckCircle2 className="w-4 h-4" />, activeClass: 'bg-slate-600 text-white shadow-sm shadow-slate-600/25', countClass: 'bg-white/20 text-white' },
] as const

const formatBudget = (from?: number, to?: number) => {
  if (!from && !to) return 'По договорённости'
  if (from && to) return `${from.toLocaleString('ru')} — ${to.toLocaleString('ru')} ₽`
  return `${(from || to)!.toLocaleString('ru')} ₽`
}

const formatDate = (d: string) => {
  const date = new Date(d)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const isUrgent = (deadline?: string) => {
  if (!deadline) return false
  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return daysLeft >= 0 && daysLeft <= 5
}

const daysUntilDeadline = (deadline?: string) => {
  if (!deadline) return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return null
  return days
}

export function OrdersView() {
  const { navigateToOrder, addToast } = useAppStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [region, setRegion] = useState('')
  const [statusTab, setStatusTab] = useState<string>('OPEN')
  const [counts, setCounts] = useState<Record<string, number>>({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12', search, category, region, status: statusTab })
      const res = await fetch(`/api/orders?${params}`)
      const data = await res.json()
      setOrders(data.orders || [])
      setTotalPages(data.pages || 1)
    } catch {
      addToast('Ошибка загрузки', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, category, region, statusTab])

  const fetchCounts = useCallback(async () => {
    try {
      const [openRes, ipRes, compRes] = await Promise.all([
        fetch('/api/orders?limit=1&status=OPEN'),
        fetch('/api/orders?limit=1&status=IN_PROGRESS'),
        fetch('/api/orders?limit=1&status=COMPLETED'),
      ])
      const [openD, ipD, compD] = await Promise.all([openRes.json(), ipRes.json(), compRes.json()])
      setCounts({
        OPEN: openD.total || 0,
        IN_PROGRESS: ipD.total || 0,
        COMPLETED: compD.total || 0,
      })
    } catch { /* silent */ }
  }, [search, category, region])

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch('/api/orders/regions').then(r => r.json()).then(d => setRegions(d.regions || []))
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { fetchCounts() }, [fetchCounts])

  const handleTabChange = (tab: string) => {
    setStatusTab(tab)
    setPage(1)
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
              statusTab === tab.key
                ? tab.activeClass
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="lg:hidden">{tab.label.slice(0, -2)}</span>
            {(counts[tab.key] ?? 0) > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                statusTab === tab.key ? tab.countClass : 'bg-background/50'
              }`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Фильтры</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск по названию..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <Select value={category} onValueChange={(v) => { setCategory(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Категория" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={region} onValueChange={(v) => { setRegion(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Регион" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все регионы</SelectItem>
                {regions.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setCategory(''); setRegion(''); setPage(1) }}>
              Сбросить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border bg-card">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between pt-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">
            {statusTab === 'OPEN' ? 'Открытых заказов нет' : statusTab === 'IN_PROGRESS' ? 'Заказов в работе нет' : 'Выполненных заказов нет'}
          </p>
          <p className="text-sm mt-1">Попробуйте изменить параметры поиска</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orders.map((order, i) => {
              const urgent = isUrgent(order.deadline)
              const days = daysUntilDeadline(order.deadline)
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.25 }}
                >
                  <Card className="card-hover cursor-pointer border bg-card h-full flex flex-col" onClick={() => navigateToOrder(order.id)}>
                    <CardContent className="p-4 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={statusColor(order.status)}>{statusLabel[order.status]}</Badge>
                          {urgent && (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-[10px] px-1.5">
                              <AlertTriangle className="w-3 h-3 mr-0.5" />
                              Срочно
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                      </div>
                      <h3 className="font-medium text-sm mb-1.5 line-clamp-2 leading-snug">{order.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{order.description}</p>
                      <div className="space-y-2">
                        {order.category && (
                          <Badge variant="secondary" className="text-xs">{order.category.name}</Badge>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            {order.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{order.city}</span>}
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{order._count?.responses || 0}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border flex items-center justify-between">
                          <span className="text-sm font-semibold">{formatBudget(order.budgetFrom, order.budgetTo)}</span>
                          {order.deadline && days !== null && (
                            <span className={`text-xs flex items-center gap-1 ${urgent ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                              <Clock className="w-3 h-3" />
                              {days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `ост. ${days} дн.`}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {page} из {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}