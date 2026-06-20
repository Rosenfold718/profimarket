'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { ClipboardList, Star, CheckCircle2 } from 'lucide-react'

export function MyResponsesView() {
  const { user, navigateToOrder, addToast } = useAppStore()
  const [responses, setResponses] = useState<Array<{
    id: string; message: string; proposedBudget?: number; status: string; createdAt: string
    order: { id: string; title: string; status: string; budgetFrom?: number; budgetTo?: number; city?: string; _count: { responses: number } }
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetch('/api/orders?limit=50&status=OPEN,IN_PROGRESS,COMPLETED&includeResponses=true')
      .then(r => r.json())
      .then(d => {
        const myResponses: typeof responses = []
        for (const order of (d.orders || [])) {
          for (const resp of (order.responses || [])) {
            if (resp.executor.id === user.id) {
              myResponses.push({ ...resp, order })
            }
          }
        }
        setResponses(myResponses)
      })
      .catch(() => addToast('Ошибка загрузки', 'error'))
      .finally(() => setLoading(false))
  }, [user])

  const statusColor = (s: string) =>
    s === 'ACCEPTED' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
    s === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-muted text-muted-foreground'

  const statusLabel: Record<string, string> = { PENDING: 'На рассмотрении', ACCEPTED: 'Принят', REJECTED: 'Отклонён' }

  if (loading) return <div className="p-5 lg:p-8 max-w-5xl mx-auto space-y-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>

  return (
    <div className="p-5 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Мои отклики</h2>
        <p className="text-muted-foreground mt-1.5">Отслеживайте статусы ваших откликов</p>
      </div>

      {responses.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">У вас пока нет откликов</p>
          <p className="text-sm mt-1">Просмотрите каталог заказов и откликнитесь</p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="card-hover cursor-pointer border bg-card" onClick={() => navigateToOrder(r.order.id)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge className={statusColor(r.status)}>{statusLabel[r.status]}</Badge>
                      </div>
                      <h3 className="font-semibold text-sm truncate">{r.order.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{r.message}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.proposedBudget && <p className="text-sm font-semibold text-amber-600">{r.proposedBudget.toLocaleString('ru')} ₽</p>}
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
