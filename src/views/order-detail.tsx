'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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
  MapPin, Clock, MessageSquare, ArrowLeft, Send, Star,
  Briefcase, CheckCircle2, XCircle, Loader2, CircleCheckBig, Trash2, Paperclip,
  FileText, Download, X, Check, CheckCheck, Image as ImageIcon, Zap,
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

interface Message {
  id: string; content: string; senderId: string; read: boolean; createdAt: string
  attachmentUrl?: string; attachmentName?: string; attachmentType?: string; attachmentSize?: number
  sender: { id: string; name: string; role: string; avatar?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function isImageType(mimeType?: string): boolean {
  if (!mimeType) return false
  return mimeType.startsWith('image/')
}

function isUserOnline(lastSeenAt?: string): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < 60_000
}

const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-emerald-800',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
}

const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }
const responseStatusLabel: Record<string, string> = { PENDING: 'На рассмотрении', ACCEPTED: 'Принят', REJECTED: 'Отклонён' }

// ─── Read receipt checkmarks ──────────────────────────────────────────────────
function ReadCheck({ read }: { read: boolean }) {
  if (read) {
    return <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/70" />
  }
  return <Check className="w-3.5 h-3.5 text-primary-foreground/50" />
}

// ─── Online dot ───────────────────────────────────────────────────────────────
function OnlineDot({ lastSeenAt }: { lastSeenAt?: string }) {
  const [online, setOnline] = useState(isUserOnline(lastSeenAt))
  useEffect(() => {
    const timer = setInterval(() => setOnline(isUserOnline(lastSeenAt)), 15_000)
    return () => clearInterval(timer)
  }, [lastSeenAt])
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} title={online ? 'В сети' : 'Не в сети'} />
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function OrderDetailView() {
  const { selectedOrderId, selectedOrderTab, user, setView, navigateToProfile, addToast, setUnreadChats } = useAppStore()
  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [deletingMsg, setDeletingMsg] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [tab, setTab] = useState<'info' | 'responses' | 'chat'>((selectedOrderTab as 'info' | 'responses' | 'chat') || 'info')
  const [showResponseForm, setShowResponseForm] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [responseBudget, setResponseBudget] = useState('')
  const [responding, setResponding] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)
  const messagesRef = useRef<Message[]>([])

  // Sync ref synchronously
  const updateMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      messagesRef.current = next
      return next
    })
  }, [])

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  // Track scroll position
  useEffect(() => {
    if (tab !== 'chat') return
    const container = messagesEndRef.current?.parentElement
    if (!container) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 60
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [tab, loading])

  // Scroll on new messages
  useEffect(() => { scrollToBottom() }, [messages.length])

  // Poll for new messages
  useEffect(() => {
    if (tab !== 'chat' || !selectedOrderId || loading) return
    const timer = setInterval(async () => {
      const currentMsgs = messagesRef.current
      if (currentMsgs.length === 0) return
      const newestTime = currentMsgs[currentMsgs.length - 1]?.createdAt
      if (!newestTime) return
      try {
        const res = await authFetch(`/api/orders/${selectedOrderId}/messages?since=${encodeURIComponent(newestTime)}`)
        const data = await res.json()
        const newMsgs: Message[] = data.messages || []
        if (newMsgs.length > 0) {
          const existingIds = new Set(messagesRef.current.map(m => m.id))
          const fresh = newMsgs.filter(m => !existingIds.has(m.id))
          if (fresh.length > 0) {
            updateMessages(prev => {
              const merged = [...prev, ...fresh].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              messagesRef.current = merged
              return merged
            })
            if (wasAtBottomRef.current) setTimeout(() => scrollToBottom(), 50)
          }
        }
      } catch { /* silent */ }
    }, 2000)
    return () => clearInterval(timer)
  }, [tab, selectedOrderId, loading, updateMessages])

  // ─── Load order ─────────────────────────────────────────────────────────────
  const loadOrder = useCallback(async () => {
    if (!selectedOrderId) return
    setLoading(true)
    try {
      const [orderRes, msgRes] = await Promise.all([
        fetch(`/api/orders/${selectedOrderId}`),
        authFetch(`/api/orders/${selectedOrderId}/messages`),
      ])
      const orderData = await orderRes.json()
      setOrder(orderData.order)
      const msgData = await msgRes.json()
      const msgs: Message[] = msgData.messages || []
      updateMessages(msgs)

      // Mark unread messages from others as read
      const unreadFromOthers = msgs.filter(m => !m.read && m.senderId !== user?.id).length
      if (unreadFromOthers > 0) {
        authFetch(`/api/orders/${selectedOrderId}/messages`, { method: 'PATCH' })
          .then(() => setUnreadChats(Math.max(0, useAppStore.getState().unreadChats - unreadFromOthers)))
          .catch(() => {})
      }
    } catch {
      addToast('Ошибка загрузки', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedOrderId, updateMessages, setUnreadChats, user?.id, addToast])

  useEffect(() => { loadOrder() }, [loadOrder])

  // ─── File handling ──────────────────────────────────────────────────────────
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        addToast('Файл слишком большой (макс. 10 МБ)', 'error')
        e.target.value = ''
        return
      }
      setAttachedFile(file)
    }
  }

  const removeFile = () => {
    setAttachedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!chatInput.trim() && !attachedFile) || !selectedOrderId) return
    setSending(true)
    try {
      let res: Response
      if (attachedFile) {
        const formData = new FormData()
        if (chatInput.trim()) formData.append('content', chatInput.trim())
        formData.append('file', attachedFile)
        res = await authFetch(`/api/orders/${selectedOrderId}/messages`, {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await authFetch(`/api/orders/${selectedOrderId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: chatInput.trim() }),
        })
      }

      if (!res.ok) {
        try { const d = await res.json(); addToast(d.error || 'Ошибка отправки', 'error') }
        catch { addToast('Ошибка отправки', 'error') }
      } else {
        const data = await res.json()
        if (data.message) {
          updateMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev
            const merged = [...prev, data.message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            messagesRef.current = merged
            return merged
          })
        }
        setChatInput('')
        removeFile()
      }
    } catch {
      addToast('Ошибка отправки', 'error')
    } finally {
      setSending(false)
    }
  }

  // ─── Delete message ─────────────────────────────────────────────────────────
  const deleteMessage = async (msgId: string) => {
    if (!selectedOrderId) return
    setDeletingMsg(true)
    try {
      const res = await authFetch(`/api/orders/${selectedOrderId}/messages/${msgId}`, { method: 'DELETE' })
      if (res.ok) {
        updateMessages(prev => prev.filter(m => m.id !== msgId))
      } else {
        const d = await res.json()
        addToast(d.error || 'Ошибка удаления', 'error')
      }
    } catch {
      addToast('Ошибка сети', 'error')
    } finally {
      setDeletingMsg(false)
      setDeleteMsgId(null)
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
  const otherUser = isClient ? order.executor : order.client

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
              <div className="flex gap-2 shrink-0">
                <Button onClick={() => { setTab('responses'); setShowResponseForm(true) }} size="sm" className="gap-1.5">
                  Откликнуться
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTab('chat')} className="gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Написать
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-5 overflow-x-auto">
        {(['info', 'responses', 'chat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'info' ? 'Описание' : t === 'responses' ? `Отклики (${order.responses.length})` : `Чат (${messages.length})`}
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
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>{order.responses.length} откликов</span>
                      </div>
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
                      <div className="flex gap-2">
                        <Button onClick={() => setShowResponseForm(true)} size="sm" className="gap-2">
                          <Zap className="w-3.5 h-3.5" />
                          Откликнуться на заказ
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setTab('chat')} className="gap-2">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Написать заказчику
                        </Button>
                      </div>
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
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
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

            {/* ─── Chat tab ──────────────────────────────────────────────────── */}
            {tab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="border bg-card">
                  <CardContent className="p-0 flex flex-col" style={{ height: 'min(500px, calc(100dvh - 340px))' }}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                      {messages.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                          <p className="text-sm">Начните переписку по заказу</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMine = msg.sender.id === user?.id
                          return (
                            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] ${isMine ? 'order-2' : ''}`}>
                                <div className={`flex items-center gap-1.5 ${isMine ? 'justify-end' : ''}`}>
                                  {!isMine && (
                                    <span className="text-xs font-medium text-muted-foreground">{msg.sender.name}</span>
                                  )}
                                </div>
                                <div className={`relative group rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                  isMine
                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                    : 'bg-muted rounded-bl-sm'
                                }`}>
                                  {/* Image attachment */}
                                  {msg.attachmentUrl && isImageType(msg.attachmentType) && (
                                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mb-2 -mx-1 -mt-1">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={msg.attachmentUrl}
                                        alt={msg.attachmentName || 'Изображение'}
                                        className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      />
                                    </a>
                                  )}
                                  {/* File attachment (non-image) */}
                                  {msg.attachmentUrl && !isImageType(msg.attachmentType) && (
                                    <a
                                      href={msg.attachmentUrl}
                                      download={msg.attachmentName}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2.5 p-2.5 rounded-lg mb-2 transition-colors ${
                                        isMine
                                          ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25'
                                          : 'bg-background/60 hover:bg-background/80'
                                      }`}
                                    >
                                      {msg.attachmentType?.startsWith('video') ? (
                                        <ImageIcon className="w-5 h-5 shrink-0" />
                                      ) : (
                                        <FileText className="w-5 h-5 shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{msg.attachmentName}</p>
                                        {msg.attachmentSize != null && (
                                          <p className="text-[11px] opacity-70">{formatFileSize(msg.attachmentSize)}</p>
                                        )}
                                      </div>
                                      <Download className="w-4 h-4 shrink-0 opacity-70" />
                                    </a>
                                  )}
                                  {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                                  {/* Delete button for own messages */}
                                  {isMine && (
                                    <button
                                      onClick={() => setDeleteMsgId(msg.id)}
                                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-background shadow-sm border text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                      aria-label="Удалить сообщение"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                {/* Time + read receipt */}
                                <div className={`flex items-center gap-1 mt-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isMine && <ReadCheck read={msg.read} />}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    {/* Input */}
                    <div className="p-3 border-t border-border">
                      {attachedFile && (
                        <div className="mb-2">
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
                            <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                            {attachedFile.type.startsWith('image/') && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={URL.createObjectURL(attachedFile)} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                            )}
                            <span className="flex-1 truncate">{attachedFile.name}</span>
                            <span className="text-muted-foreground text-xs">{formatFileSize(attachedFile.size)}</span>
                            <button onClick={removeFile} className="p-0.5 rounded hover:bg-muted-foreground/20 transition-colors" aria-label="Удалить файл">
                              <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                          onChange={onFileChange}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending}
                          aria-label="Прикрепить файл"
                        >
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <Textarea
                          placeholder="Введите сообщение..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                          rows={1}
                          className="flex-1 resize-none min-h-[38px]"
                        />
                        <Button
                          onClick={sendMessage}
                          disabled={sending || (!chatInput.trim() && !attachedFile)}
                          size="icon"
                          className="shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Delete message confirmation */}
            <AlertDialog open={!!deleteMsgId} onOpenChange={(open) => !open && setDeleteMsgId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить сообщение?</AlertDialogTitle>
                  <AlertDialogDescription>Сообщение будет удалено безвозвратно.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingMsg}>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMsgId && deleteMessage(deleteMsgId)}
                    disabled={deletingMsg}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingMsg ? 'Удаление...' : 'Удалить'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </AnimatePresence>
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
                <div className="relative">
                  <button
                    onClick={() => navigateToProfile(otherUser?.id || '')}
                    className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg overflow-hidden"
                  >
                    {otherUser?.avatar ? (
                      <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      otherUser?.name?.charAt(0) || '?'
                    )}
                  </button>
                  <OnlineDot lastSeenAt={otherUser?.lastSeenAt} />
                </div>
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigateToProfile(otherUser?.id || '')} className="font-medium text-sm hover:underline truncate block">
                    {otherUser?.name || 'Не назначен'}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {isClient
                      ? (otherUser ? `${isUserOnline(otherUser.lastSeenAt) ? 'В сети' : 'Не в сети'}` : 'Не выбран')
                      : order.client.role === 'CLIENT' ? 'Заказчик' : 'Организация'}
                  </p>
                </div>
                {otherUser && (
                  <Button variant="outline" size="sm" onClick={() => setTab('chat')} className="shrink-0 gap-1.5 text-xs">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Чат
                  </Button>
                )}
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
                <MessageSquare className="w-4 h-4 shrink-0" />{order.responses.length} откликов
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