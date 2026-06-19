'use client'
import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { Save, Loader2, User, Building, Phone, Globe, Award, GraduationCap, MapPin, Camera, X } from 'lucide-react'

const SPECIALIZATIONS = [
  'Сметное дело', 'Строительная экспертиза', 'Проектирование', 'Кадастр',
  'Юридические услуги', 'Оценка недвижимости', 'Технический надзор', 'Геодезия',
]

export function ProfileEditView() {
  const { user, setUser, addToast } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '', phone: '', company: '', position: '', experienceYears: '',
    specializations: [] as string[], description: '', region: '', city: '',
    education: '', certificates: '', website: '',
  })

  useEffect(() => {
    if (!user) return
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      company: user.profile?.company || '',
      position: user.profile?.position || '',
      experienceYears: user.profile?.experienceYears?.toString() || '',
      specializations: user.profile?.specializations ? JSON.parse(user.profile.specializations) : [],
      description: user.profile?.description || '',
      region: user.profile?.region || '',
      city: user.profile?.city || '',
      education: user.profile?.education ? JSON.parse(user.profile.education).join('\n') : '',
      certificates: user.profile?.certificates ? JSON.parse(user.profile.certificates).join('\n') : '',
      website: user.profile?.website || '',
    })
    if (user.avatar) setAvatarPreview(user.avatar)
    setLoading(false)
  }, [user])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { addToast('Файл не более 2 МБ', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const toggleSpec = (spec: string) => {
    setForm((f) => ({
      ...f,
      specializations: f.specializations.includes(spec)
        ? f.specializations.filter((s) => s !== spec)
        : [...f.specializations, spec],
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        phone: form.phone,
        company: form.company,
        position: form.position,
        experienceYears: form.experienceYears ? parseInt(form.experienceYears) : undefined,
        specializations: JSON.stringify(form.specializations),
        description: form.description,
        region: form.region,
        city: form.city,
        education: JSON.stringify(form.education.split('\n').filter(Boolean)),
        certificates: JSON.stringify(form.certificates.split('\n').filter(Boolean)),
        website: form.website,
        avatar: avatarPreview || undefined,
      }

      const res = await authFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUser(data.user)
      addToast('Профиль обновлён!', 'success')
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-72 w-full" />
    </div>
  )

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold mb-6">Мой профиль</h2>

        {/* Avatar section */}
        <Card className="border bg-card mb-5">
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.charAt(0) || '?'
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
                {avatarPreview && (
                  <button
                    onClick={() => setAvatarPreview(null)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{form.name || 'Без имени'}</h3>
                <p className="text-sm text-muted-foreground">{user?.role === 'CLIENT' ? 'Заказчик' : 'Исполнитель'}</p>
                {user?.email && <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {/* Basic info */}
          <Card className="border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2.5">
                <User className="w-5 h-5 text-primary" />Основная информация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">ФИО / Название организации</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Телефон</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 (999) 123-45-67" className="h-11" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-sm font-medium flex items-center gap-1.5"><Building className="w-3.5 h-3.5" />Компания</Label>
                  <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="ООО «Название»" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Должность</Label>
                  <Input id="position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Ведущий инженер" className="h-11" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Executor fields */}
          {user?.role === 'EXECUTOR' && (
            <>
              <Card className="border bg-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Специализации</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2.5">
                    {SPECIALIZATIONS.map((spec) => (
                      <button
                        key={spec}
                        onClick={() => toggleSpec(spec)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          form.specializations.includes(spec)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Опыт и квалификация</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid sm:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Опыт работы (лет)</Label>
                      <Input type="number" min="0" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} placeholder="5" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Регион</Label>
                      <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Московская область" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Город</Label>
                      <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Москва" className="h-11" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">О себе</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Расскажите о вашем опыте, компетенциях и подходе к работе..." className="resize-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" />Образование</Label>
                    <Textarea value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} rows={2} placeholder={"МГСУ, строительный факультет, 2010\nМИЭТ, факультет информатики, 2015"} className="resize-none" />
                    <p className="text-xs text-muted-foreground">Каждое учебное заведение с новой строки</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5"><Award className="w-3.5 h-3.5" />Сертификаты и допуски</Label>
                    <Textarea value={form.certificates} onChange={(e) => setForm({ ...form, certificates: e.target.value })} rows={2} placeholder={"Членство в СРО\nЛицензия на проведение экспертизы"} className="resize-none" />
                    <p className="text-xs text-muted-foreground">Каждый сертификат с новой строки</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2.5">
                    <Globe className="w-5 h-5 text-primary" />Контакты
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Сайт</Label>
                    <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" className="h-11" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button onClick={save} disabled={saving} className="min-w-[160px] h-11 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить изменения
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}