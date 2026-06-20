'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { Search, MapPin, Building2, Briefcase, ChevronLeft, ChevronRight, Users } from 'lucide-react'

interface ClientUser {
  id: string; name: string; role: string; avatar?: string; createdAt: string
  profile: { id: string; company?: string; position?: string; experienceYears?: number
    specializations?: string; description?: string; region?: string; city?: string
    rating: number; completedOrders: number } | null
  _count: { orders: number }
}

export function ClientsView() {
  const { navigateToProfile, addToast } = useAppStore()
  const [clients, setClients] = useState<ClientUser[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12', search, region })
      const res = await fetch(`/api/clients?${params}`)
      const data = await res.json()
      setClients(data.clients || [])
      setTotalPages(data.pages || 1)
    } catch {
      addToast('Ошибка загрузки', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, region])

  useEffect(() => { fetchClients() }, [fetchClients])

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Заказчики</h2>
          <p className="text-muted-foreground mt-1">Компании и частные лица, размещающие заказы</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск по имени или компании..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <Select value={region} onValueChange={(v) => { setRegion(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Регион" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все регионы</SelectItem>
                <SelectItem value="Москва">Москва</SelectItem>
                <SelectItem value="Санкт-Петербург">Санкт-Петербург</SelectItem>
                <SelectItem value="Московская область">Московская область</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearch(''); setRegion(''); setPage(1) }}>
              Сбросить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm"><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Заказчики не найдены</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Попробуйте изменить параметры поиска или сбросить фильтры</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c, i) => {
            const p = c.profile
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="card-hover cursor-pointer border-0 shadow-sm h-full" onClick={() => navigateToProfile(c.id)}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
                        {c.avatar ? (
                          <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          c.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                        {p?.company && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{p.company}</span>
                          </div>
                        )}
                        {p?.position && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{p.position}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {c._count.orders > 0 && (
                            <span className="text-xs text-muted-foreground">{c._count.orders} {c._count.orders === 1 ? 'заказ' : c._count.orders < 5 ? 'заказа' : 'заказов'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {(p?.city || p?.region) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                        <MapPin className="w-3.5 h-3.5" />
                        {p.city}{p.city && p.region ? ', ' : ''}{p.region}
                      </div>
                    )}
                    {p?.description && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{p.description}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground px-3">{page} из {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  )
}