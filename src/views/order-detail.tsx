'use client'
import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Clock, ArrowLeft, Star,
  Briefcase, CheckCircle2, XCircle, Loader2, CircleCheckBig,
  FileText, Download, Upload, Trash2, X, Image as ImageIcon, Zap,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Order {
  id: string; title: string; description: string; status: string
  budgetFrom?: number; budgetTo?: number; region?: string; city?: string
  deadline?: string; createdAt: string
  category?: { name: string } | null
  client: { id: string; name: string; role: string; phone?: string; avatar?: string; profile?: Record<string, unknown> | null; lastSeenAt?: string }
  executor?: { id: string; name: string; role: string; phone?: string; avatar?: string; profile?: Record<string, unknown> | null; lastSeenAt?: string } | null
  responses: OrderResponse[]
  _count: { messages: number }
}

interface OrderResponse {
  id: string; message: string; proposedBudget?: number; proposedDeadline?: string
  status: string; createdAt: string
  executor: { id: string; name: string; role: string; avatar?: string; profile?: Record<string, unknown> | null }
}

interface OrderDocument {
  id: string; name: string; type: string; size: number; createdAt: string
  uploadedById: string; uploaderName?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-emerald-800',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
}

const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }
const responseStatusLabel: Record<string, string> = { PENDING: 'На рассмотрении', ACCEPTED: 'Принят', REJECTED: 'Отклонён' }

// ─── Main Component ───────────────────────────────────────────────────────────
export function OrderDetailView() {
  const { selectedOrderId, selectedOrderTab, user, setView, navigateToProfile, addToast } = useAppStore()
  const [order, setOrder] = useState<Order | null>(null)
  const [documents, setDocuments] = useState<OrderDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'responses' | 'docs'>((selectedOrderTab as 'info' | 'responses' | 'docs') || 'info')
  const [showResponseForm, setShowResponseForm] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [responseBudget, setResponseBudget] = useState('')
  const [responding, setResponding] = useState(false)

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [deletingDoc, setDeletingDoc] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)

  // ─── Load order ─────────────────────────────────────────────────────────────
  const loadOrder = async () => {
    if (!selectedOrderId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}`)
      const data = await res.json()
      setOrder(data.order)
      // Load documents
      loadDocuments(selectedOrderId)
    } catch {
      addToast('Ошибка загрузки', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadDocuments = async (orderId: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/documents`)
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch { /* silent */ }
  }

  useEffect(() => { loadOrder() }, [selectedOrderId])

  // ─── Upload document ────────────────────────────────────────────────────────
  const onDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        addToast('Файл слишком большой (макс. 10 МБ)', 'error')
        e.target.value = ''
        return
      }
      uploadDocument(file)
      e.target.value = ''
    }
  }

  const uploadDocument = async (file: File) => {
    if (!selectedOrderId) return
    setUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await authFetch(`/api/orders/${selectedOrderId}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const d = await res.json()
        addToast(d.error || 'Ошибка загрузки', 'error')
      } else {
        addToast('Документ загружен', 'success')
        loadDocuments(selectedOrderId)
      }
    } catch {
      addToast('Ошибка загрузки', 'error')
    } finally {
      setUploadingDoc(false)
    }
  }

  // ─── Delete document ────────────────────────────────────────────────────────
  const deleteDocument = async (docId: string) => {
    if (!selectedOrderId) return
    setDeletingDoc(true)
    try {
      const res = await authFetch(`/api/orders/${selectedOrderId}/documents/${docId}`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId))
        addToast('Документ удалён', 'info')
      } else {
        const d = await res.json()
        addToast(d.error || 'Ошибка удаления', 'error')
      }
    } catch {
      addToast('Ошибка удаления', 'error')
    } finally {
      setDeletingDoc(false)
      setDeleteDocId(null)
    }
  }

  // ─── Submit response ────────────────────────────────────────────────────────
  const submitResponse = async () => {
    if (!responseText.trim() || !selectedOrderId) return
    setResponding(true)
    try {
      const res = await authFetch(`/api/orders/${selectedOrderId}/responses`, {
        method: 'POST',
        body: JSON.stringify({
          message: responseText,
          proposedBudget: responseBudget ? parseFloat(responseBudget) : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        addToast(data.error || 'Ошибка отклика', 'error')
      } else {
        addToast('Отклик отправлен!', 'success')
        setShowResponseForm(false)
        setResponseText('')
        setResponseBudget('')
        loadOrder()
      }
    } catch {
      addToast('Ошибка отправки отклика', 'error')
    } finally {
      setResponding(false)
    }
  }

  // ─── Handle response accept/reject ──────────────────────────────────────────
  const handleResponse = async (responseId: string, status: 'ACCEPTED' | 'REJECTED') => {
    try {
      const res = await authFetch(`/api/orders/${selectedOrderId}/responses`, {
        method: 'PATCH',
        body: JSON.stringify({ responseId, status }),
      })
      if (!res.ok) throw new Error()
      addToast(status === 'ACCEPTED' ? 'Исполнитель выбран!' : 'Отклик отклонён', status === 'ACCEPTED' ? 'success' : 'info')
      loadOrder()
    } catch {
      addToast('Ошибка', 'error')
    }
  }

  // ─── Complete order ─────────────────────────────────────────────────────────
  const completeOrder = async () => {
    if (!selectedOrderId) return
    try {
      const res = await authFetch(`/api/orders/${selectedOrderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      if (!res.ok) throw new Error()
      addToast('Заказ отмечен как выполненный!', 'success')
      loadOrder()
    } catch {
      addToast('Ошибка', 'error')
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-60 w-full" />
    </div>
  )

  if (!order) return (
    <div className="p-4 lg:p-6 text-center text-muted-foreground">
      <p>Заказ не найден</p>
      <Button variant="link" onClick={() => setView('orders')}>Вернуться к заказам</Button>
    </div>
  )

  const isClient = user?.id === order.client.id
  const isExecutor = user?.id === order.executor?.id
  const canRespond = !isClient && user?.role === 'EXECUTOR' && order.status === 'OPEN' && !order.responses.some(r => r.executor.id === user?.id)

  // Who can upload docs: client always, executor if assigned, admin
  const canUploadDocs = isClient || isExecutor || user?.role === 'ADMIN'

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Back + title */}
      <div className="mb-5">
        <button onClick={() => setView('orders')} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2.5">
          <ArrowLeft className="w-3.5 h-3.5" />Назад к заказам
        </button>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className={statusColor[order.status]}>{statusLabel[order.status]}</Badge>
              {order.category && <Badge variant="secondary">{order.category.name}</Badge>}
            </div>
            <h1 className="text-xl lg:text-2xl font-bold font-[family-name:var(--font-display)]">{order.title}</h1>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-lg font-bold">
              {order.budgetFrom && order.budgetTo
                ? `${order.budgetFrom.toLocaleString('ru')} — ${order.budgetTo.toLocaleString('ru')} ₽`
                : order.budgetFrom || order.budgetTo
                  ? `${(order.budgetFrom || order.budgetTo)!.toLocaleString('ru')} ₽`
                  : 'По договорённости'}
            </p>
            {isClient && order.status === 'IN_PROGRESS' && (
              <Button size="sm" onClick={completeOrder} className="mt-2 gap-1.5">
                <CircleCheckBig className="w-4 h-4" />
                Завершить заказ
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── PROMINENT CTA for executors ─────────────────────────────────── */}
      {canRespond && tab !== 'responses' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <Card className="border-primary/30 bg-primary/[0.02]">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Хотите выполнить этот заказ?
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Отправьте отклик, чтобы предложить свои услуги заказчику</p>
              </div>
              <Button onClick={() => { setTab('responses'); setShowResponseForm(true) }} size="sm" className="gap-1.5 shrink-0">
                Откликнуться
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-5 overflow-x-auto">
        {(['info', 'responses', 'docs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'info' ? 'Описание' : t === 'responses' ? `Отклики (${order.responses.length})` : `Документы (${documents.length})`}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* ─── Info tab ──────────────────────────────────────────────────── */}
            {tab === 'info' && (
              <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <Card className="border bg-card">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3 text-sm">Подробное описание</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{order.description}</p>
                  </CardContent>
                </Card>
                <Card className="border bg-card">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3 text-sm">Детали</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>{[order.city, order.region].filter(Boolean).join(', ') || 'Не указан'}</span>
                      </div>
                      {order.deadline && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>до {new Date(order.deadline).toLocaleDateString('ru-RU')}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="w-4 h-4 shrink-0" />
                        <span>Создан {new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── Responses tab ─────────────────────────────────────────────── */}
            {tab === 'responses' && (
              <motion.div key="responses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {canRespond && (
                  <div className="mb-3">
                    {!showResponseForm ? (
                      <Button onClick={() => setShowResponseForm(true)} size="sm" className="gap-2">
                        <Zap className="w-3.5 h-3.5" />
                        Откликнуться на заказ
                      </Button>
                    ) : (
                      <Card className="border-accent/30 bg-card">
                        <CardContent className="p-5 space-y-3">
                          <h4 className="font-medium text-sm">Ваш отклик</h4>
                          <Textarea placeholder="Опишите, почему вы подходите для этого заказа, ваш опыт и подход..." value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={4} />
                          <Input type="number" placeholder="Предлагаемый бюджет (₽)" value={responseBudget} onChange={(e) => setResponseBudget(e.target.value)} />
                          <div className="flex gap-2">
                            <Button onClick={submitResponse} disabled={responding || !responseText.trim()} size="sm">
                              {responding && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                              Отправить отклик
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowResponseForm(false)}>Отмена</Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                {order.responses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Пока нет откликов</p>
                  </div>
                ) : (
                  order.responses.map((r, i) => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card className="border bg-card">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <button onClick={() => navigateToProfile(r.executor.id)} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm overflow-hidden">
                                {r.executor.avatar ? (
                                  <img src={r.executor.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  r.executor.name.charAt(0)
                                )}
                              </button>
                              <div>
                                <button onClick={() => navigateToProfile(r.executor.id)} className="font-medium text-sm hover:underline">
                                  {r.executor.name}
                                </button>
                                {r.executor.profile && typeof r.executor.profile === 'object' && 'rating' in r.executor.profile && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                    {(r.executor.profile as Record<string, unknown>).rating}
                                    {'completedOrders' in r.executor.profile && ` · ${(r.executor.profile as Record<string, unknown>).completedOrders} заказов`}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className={
                              r.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                              r.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                              'text-muted-foreground'
                            }>
                              {responseStatusLabel[r.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{r.message}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            {r.proposedBudget && <span className="font-semibold text-foreground">{r.proposedBudget.toLocaleString('ru')} ₽</span>}
                            {r.proposedDeadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />до {new Date(r.proposedDeadline).toLocaleDateString('ru-RU')}</span>}
                            <span>{new Date(r.createdAt).toLocaleDateString('ru-RU')}</span>
                          </div>
                          {isClient && r.status === 'PENDING' && order.status === 'OPEN' && (
                            <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                              <Button size="sm" onClick={() => handleResponse(r.id, 'ACCEPTED')} className="gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />Принять
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleResponse(r.id, 'REJECTED')} className="text-destructive hover:bg-destructive/10 gap-1.5">
                                <XCircle className="w-3.5 h-3.5" />Отклонить
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {/* ─── Docs tab ────────────────────────────────────────────────── */}
            {tab === 'docs' && (
              <motion.div key="docs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Upload button */}
                {canUploadDocs && (
                  <div>
                    <input
                      ref={docInputRef}
                      type="file"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                      onChange={onDocFileChange}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => docInputRef.current?.click()}
                      disabled={uploadingDoc}
                      className="gap-2"
                    >
                      {uploadingDoc ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploadingDoc ? 'Загрузка...' : 'Загрузить документ'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5">Макс. 10 МБ · PDF, DOC, XLS, изображения, архивы</p>
                  </div>
                )}

                {/* Documents list */}
                {documents.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Документов пока нет</p>
                    {canUploadDocs && <p className="text-xs mt-1">Нажмите «Загрузить документ» выше</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <Card key={doc.id} className="border bg-card group">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            {doc.type?.startsWith('image/') ? (
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <FileText className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.uploaderName || 'Пользователь'} · {formatFileSize(doc.size)} · {new Date(doc.createdAt).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <a
                            href={`/api/orders/${selectedOrderId}/documents?download=${doc.id}`}
                            download={doc.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
                            title="Скачать"
                          >
                            <Download className="w-4 h-4 text-muted-foreground" />
                          </a>
                          {(doc.uploadedById === user?.id || user?.role === 'ADMIN') && (
                            <button
                              onClick={() => setDeleteDocId(doc.id)}
                              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete document confirmation */}
          <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
                <AlertDialogDescription>Документ будет удалён безвозвратно.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingDoc}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteDocId && deleteDocument(deleteDocId)}
                  disabled={deletingDoc}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingDoc ? 'Удаление...' : 'Удалить'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* ─── Sidebar ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Client/Executor info */}
          <Card className="border bg-card">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isClient ? 'Исполнитель' : 'Заказчик'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateToProfile((isClient ? order.executor : order.client)?.id || '')}
                  className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg overflow-hidden"
                >
                  {(isClient ? order.executor : order.client)?.avatar ? (
                    <img src={(isClient ? order.executor : order.client)!.avatar!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (isClient ? order.executor : order.client)?.name?.charAt(0) || '?'
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigateToProfile((isClient ? order.executor : order.client)?.id || '')} className="font-medium text-sm hover:underline truncate block">
                    {(isClient ? order.executor : order.client)?.name || 'Не назначен'}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {isClient
                      ? (order.executor ? 'Исполнитель' : 'Не выбран')
                      : order.client.role === 'CLIENT' ? 'Заказчик' : 'Организация'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order summary */}
          <Card className="border bg-card">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Информация</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5 text-sm">
              {order.city && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" />{order.city}{order.region ? `, ${order.region}` : ''}
                </div>
              )}
              {order.deadline && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" />до {new Date(order.deadline).toLocaleDateString('ru-RU')}
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4 shrink-0" />{documents.length} документов
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="w-4 h-4 shrink-0" />Создан {new Date(order.createdAt).toLocaleDateString('ru-RU')}
              </div>
            </CardContent>
          </Card>

          {/* Quick respond for executors */}
          {canRespond && tab !== 'responses' && (
            <Button className="w-full gap-2" onClick={() => { setTab('responses'); setShowResponseForm(true) }}>
              <Zap className="w-4 h-4" />
              Откликнуться на заказ
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}