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
import { Search, Star, MapPin, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react'

interface ExecutorUser {
  id: string; name: string; role: string; avatar?: string; createdAt: string
  profile: { id: string; company?: string; position?: string; experienceYears?: number
    specializations?: string; description?: string; region?: string; city?: string
    rating: number; completedOrders: number } | null
  _count: { responses: number }
}

export function UsersView() {
  const { navigateToProfile, addToast } = useAppStore()
  const [users, setUsers] = useState<ExecutorUser[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [specializations, setSpecializations] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12', role: 'EXECUTOR', search, region, specializations })
      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      setUsers(data.users || [])
      setTotalPages(data.pages || 1)
    } catch {
      addToast('Ошибка загрузки', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, region, specializations])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Исполнители</h2>
          <p className="text-muted-foreground mt-1">Найдите подходящего специалиста для вашего проекта</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск по имени..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
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
            <Select value={specializations} onValueChange={(v) => { setSpecializations(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Специализация" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="Сметное дело">Сметное дело</SelectItem>
                <SelectItem value="Строительная экспертиза">Строительная экспертиза</SelectItem>
                <SelectItem value="Проектирование">Проектирование</SelectItem>
                <SelectItem value="Кадастр">Кадастр</SelectItem>
                <SelectItem value="Юридические услуги">Юридические услуги</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearch(''); setRegion(''); setSpecializations(''); setPage(1) }}>
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
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u, i) => {
            const p = u.profile
            const specs = p?.specializations ? JSON.parse(p.specializations) : []
            return (
              <motion.div key={u.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="card-hover cursor-pointer border-0 shadow-sm h-full" onClick={() => navigateToProfile(u.id)}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{u.name}</h3>
                        {p?.company && <p className="text-xs text-muted-foreground truncate">{p.company}</p>}
                        <div className="flex items-center gap-3 mt-1.5">
                          {p?.rating > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="font-medium">{p.rating}</span>
                            </div>
                          )}
                          {p?.completedOrders > 0 && (
                            <span className="text-xs text-muted-foreground">{p.completedOrders} заказов</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {p?.city && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                        <MapPin className="w-3.5 h-3.5" />{p.city}
                      </div>
                    )}
                    {specs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {specs.slice(0, 3).map((s: string, j: number) => (
                          <Badge key={j} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {specs.length > 3 && <Badge variant="secondary" className="text-xs">+{specs.length - 3}</Badge>}
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
