'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { Briefcase, MapPin, MessageSquare, Clock, PlusCircle } from 'lucide-react'

interface Order {
  id: string; title: string; description: string; status: string
  budgetFrom?: number; budgetTo?: number; region?: string; city?: string
  createdAt: string; deadline?: string
  _count: { responses: number; messages: number }
  category?: { name: string } | null
  client?: { id: string; name: string } | null
  executor?: { id: string; name: string } | null
}

const statusColor: Record<string, string> = {
  OPEN: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}
const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }

export function MyOrdersView() {
  const { user, navigateToOrder, addToast } = useAppStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/orders?limit=50&status=OPEN,IN_PROGRESS,COMPLETED,CANCELLED')
      .then(r => r.json())
      .then(d => setOrders((d.orders || []).filter((o: Order) => o.client?.id === user?.id)))
      .catch(() => addToast('Ошибка загрузки', 'error'))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <div className="p-5 lg:p-8 max-w-5xl mx-auto space-y-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>

  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Мои заказы</h2>
          <p className="text-muted-foreground mt-1.5">Управляйте вашими заказами</p>
        </div>
        <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
          <PlusCircle className="w-4 h-4 mr-2" />Новый заказ
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Briefcase className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">У вас пока нет заказов</p>
          <p className="text-sm mt-1">Создайте первый заказ, чтобы найти исполнителей</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="card-hover cursor-pointer border bg-card" onClick={() => navigateToOrder(order.id)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge className={statusColor[order.status]}>{statusLabel[order.status]}</Badge>
                        {order.category && <span className="text-xs text-muted-foreground">{order.category.name}</span>}
                      </div>
                      <h3 className="font-semibold text-sm truncate">{order.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{order.description}</p>
                      <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground">
                        {order.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{order.city}</span>}
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{order._count?.responses || 0} откликов</span>
                        {order.executor && <span>Исполнитель: {order.executor.name}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-amber-600">
                        {order.budgetFrom && order.budgetTo ? `${(order.budgetFrom / 1000).toFixed(0)}K — ${(order.budgetTo / 1000).toFixed(0)}K ₽` : 'По договорённости'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
