'use client'
import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, PlusCircle, Upload, X, FileText, Image as ImageIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface Category {
  id: string
  name: string
  slug: string
}

export function CreateOrderView() {
  const { setView, addToast, navigateToOrder } = useAppStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    region: '',
    city: '',
    budgetFrom: '',
    budgetTo: '',
    deadline: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Document upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => setCategories(data.categories || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const update = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.title.trim().length < 5) e.title = 'Минимум 5 символов'
    if (form.description.trim().length < 20) e.description = 'Минимум 20 символов'
    if (form.budgetFrom && isNaN(Number(form.budgetFrom))) e.budgetFrom = 'Введите число'
    if (form.budgetTo && isNaN(Number(form.budgetTo))) e.budgetTo = 'Введите число'
    if (form.budgetFrom && form.budgetTo && Number(form.budgetFrom) > Number(form.budgetTo)) {
      e.budgetTo = 'Максимум не может быть меньше минимума'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const oversized = files.filter(f => f.size > 10 * 1024 * 1024)
    if (oversized.length > 0) {
      addToast(`${oversized.length} файл(ов) превышают 10 МБ и были пропущены`, 'error')
    }
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024)
    setPendingFiles(prev => [...prev, ...valid])
    e.target.value = ''
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
      }
      if (form.categoryId) body.categoryId = form.categoryId
      if (form.region.trim()) body.region = form.region.trim()
      if (form.city.trim()) body.city = form.city.trim()
      if (form.budgetFrom) body.budgetFrom = Number(form.budgetFrom)
      if (form.budgetTo) body.budgetTo = Number(form.budgetTo)
      if (form.deadline) body.deadline = form.deadline

      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        addToast(data.error || 'Ошибка создания заказа', 'error')
        return
      }

      const orderId = data.order?.id
      if (orderId && pendingFiles.length > 0) {
        // Upload documents one by one
        let uploaded = 0
        for (const file of pendingFiles) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            const docRes = await authFetch(`/api/orders/${orderId}/documents`, {
              method: 'POST',
              body: formData,
            })
            if (docRes.ok) uploaded++
          } catch { /* skip failed uploads */ }
        }
        if (uploaded > 0) {
          addToast(`Заказ создан! Загружено ${uploaded} из ${pendingFiles.length} документов`, 'success')
        } else {
          addToast('Заказ создан, но документы не загрузились. Попробуйте позже.', 'info')
        }
      } else {
        addToast('Заказ успешно создан!', 'success')
      }

      if (orderId) {
        navigateToOrder(orderId, 'docs')
      } else {
        setView('my-orders')
      }
    } catch {
      addToast('Ошибка соединения', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setView('dashboard')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-display)]">Новый заказ</h2>
        <p className="text-muted-foreground mt-1 text-sm">Опишите задачу, чтобы исполнители могли откликнуться</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border bg-card">
          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Название заказа *</label>
              <Input
                placeholder="Например: Оценка коммерческой недвижимости"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className="h-11"
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Описание *</label>
              <Textarea
                placeholder="Подробно опишите задачу, требования, объект, сроки и условия..."
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={6}
                className="resize-none"
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              <p className="text-xs text-muted-foreground">{form.description.trim().length}/20 мин. символов</p>
            </div>

            {/* Category + Region */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Категория</label>
                <Select value={form.categoryId} onValueChange={(v) => update('categoryId', v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Регион</label>
                <Input
                  placeholder="Например: Московская область"
                  value={form.region}
                  onChange={(e) => update('region', e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {/* City + Deadline */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Город</label>
                <Input
                  placeholder="Например: Москва"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Срок выполнения</label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => update('deadline', e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Бюджет (₽)</label>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  placeholder="От"
                  value={form.budgetFrom}
                  onChange={(e) => update('budgetFrom', e.target.value)}
                  className="h-11"
                  type="number"
                />
                <Input
                  placeholder="До"
                  value={form.budgetTo}
                  onChange={(e) => update('budgetTo', e.target.value)}
                  className="h-11"
                  type="number"
                />
              </div>
              {(errors.budgetFrom || errors.budgetTo) && (
                <p className="text-sm text-destructive">{errors.budgetFrom || errors.budgetTo}</p>
              )}
              {!form.budgetFrom && !form.budgetTo && (
                <p className="text-xs text-muted-foreground">Оставьте пустым для «По договорённости»</p>
              )}
            </div>

            {/* Documents upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Документы</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                onChange={onFilesChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Прикрепить файлы
              </Button>
              <p className="text-xs text-muted-foreground">Макс. 10 МБ каждый · можно выбрать несколько</p>

              {pendingFiles.length > 0 && (
                <div className="space-y-2 mt-3">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-muted rounded-lg text-sm">
                      {f.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {f.size < 1024 ? `${f.size} Б` : f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} КБ` : `${(f.size / (1024 * 1024)).toFixed(1)} МБ`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="p-0.5 rounded hover:bg-muted-foreground/20 transition-colors shrink-0"
                        aria-label="Удалить файл"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Submit */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Button
          className="w-full h-12 gap-2 text-base font-semibold"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <PlusCircle className="w-5 h-5" />
          )}
          {submitting ? 'Создание...' : 'Опубликовать заказ'}
        </Button>
      </motion.div>
    </div>
  )
}