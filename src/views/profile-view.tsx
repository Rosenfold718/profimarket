'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import {
  Star, MapPin, Briefcase, Clock, Building, GraduationCap, Award,
  Globe, ArrowLeft, ExternalLink, CheckCircle2, MessageSquare
} from 'lucide-react'

interface ProfileData {
  id: string; name: string; email: string; role: string; phone?: string
  avatar?: string; createdAt: string
  profile?: {
    id: string; company?: string; position?: string; experienceYears?: number
    specializations?: string; description?: string; region?: string; city?: string
    education?: string; certificates?: string; rating: number; completedOrders: number
    website?: string
  } | null
  _count?: { clientOrders: number; executorOrders: number; responses: number }
}

export function ProfileView() {
  const { selectedProfileId, setView, user, navigateToOrder, addToast } = useAppStore()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedProfileId) return
    fetch(`/api/profile/${selectedProfileId}`)
      .then(r => r.json())
      .then(d => setProfileData(d.user))
      .catch(() => addToast('Ошибка загрузки профиля', 'error'))
      .finally(() => setLoading(false))
  }, [selectedProfileId, addToast])

  if (loading) return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  )

  if (!profileData) return (
    <div className="p-5 lg:p-8 text-center">
      <p className="text-muted-foreground">Профиль не найден</p>
      <Button variant="link" onClick={() => setView('orders')}>Вернуться к заказам</Button>
    </div>
  )

  const p = profileData.profile
  const specs = p?.specializations ? JSON.parse(p.specializations) : []
  const edu = p?.education ? JSON.parse(p.education) : []
  const certs = p?.certificates ? JSON.parse(p.certificates) : []
  const totalOrders = (profileData._count?.clientOrders || 0) + (profileData._count?.executorOrders || 0)

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      <button onClick={() => setView('orders')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />Назад
      </button>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header card */}
        <Card className="border bg-card mb-5">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shrink-0 overflow-hidden">
                {profileData.avatar ? (
                  <img src={profileData.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  profileData.name.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold">{profileData.name}</h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Badge variant="secondary" className="text-sm">{profileData.role === 'CLIENT' ? 'Заказчик' : 'Исполнитель'}</Badge>
                  {p?.company && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building className="w-4 h-4" />{p.company}
                    </span>
                  )}
                  {p?.position && (
                    <span className="text-sm text-muted-foreground">{p.position}</span>
                  )}
                </div>
                <div className="flex items-center gap-5 mt-3 flex-wrap">
                  {p && p.rating > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-sm">{p.rating}</span>
                    </div>
                  )}
                  {p && p.completedOrders > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {p.completedOrders} заказов выполнено
                    </div>
                  )}
                  {totalOrders > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Briefcase className="w-4 h-4" />
                      {totalOrders} всего
                    </div>
                  )}
                  {p?.experienceYears && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {p.experienceYears} лет опыта
                    </div>
                  )}
                </div>
                {(p?.city || p?.region) && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                    <MapPin className="w-4 h-4" />
                    {[p.city, p.region].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content sections */}
        <div className="grid sm:grid-cols-2 gap-5">
          {p?.description && (
            <Card className="sm:col-span-2 border bg-card">
              <CardContent className="p-5">
                <h3 className="font-bold text-base mb-2.5">О себе</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
              </CardContent>
            </Card>
          )}

          {specs.length > 0 && (
            <Card className="border bg-card">
              <CardContent className="p-5">
                <h3 className="font-bold text-base mb-3">Специализации</h3>
                <div className="flex flex-wrap gap-2">
                  {specs.map((s: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-sm">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {edu.length > 0 && (
            <Card className="border bg-card">
              <CardContent className="p-5">
                <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />Образование
                </h3>
                <ul className="space-y-2">
                  {edu.map((e: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {certs.length > 0 && (
            <Card className="border bg-card">
              <CardContent className="p-5">
                <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />Сертификаты и допуски
                </h3>
                <ul className="space-y-2">
                  {certs.map((c: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {p?.website && (
            <Card className="border bg-card">
              <CardContent className="p-5">
                <h3 className="font-bold text-base mb-2.5 flex items-center gap-2">
                  <Globe className="w-4 h-4" />Сайт
                </h3>
                <a href={p.website} target="_blank" rel="noopener" className="text-sm text-primary hover:underline flex items-center gap-1">
                  {p.website} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </CardContent>
            </Card>
          )}

          {profileData.phone && (
            <Card className="border bg-card">
              <CardContent className="p-5">
                <h3 className="font-bold text-base mb-1">Контактный телефон</h3>
                <p className="text-sm text-muted-foreground">{profileData.phone}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        {user && user.id !== profileData.id && (
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => addToast('Функция будет доступна скоро', 'info')}>
              <MessageSquare className="w-4 h-4" />
              Написать
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}