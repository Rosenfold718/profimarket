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
  Briefcase, CheckCircle2, XCircle, Loader2
} from 'lucide-react'

interface Order {
  id: string; title: string; description: string; status: string
  budgetFrom?: number; budgetTo?: number; region?: string; city?: string
  deadline?: string; createdAt: string
  category?: { name: string } | null
  client: { id: string; name: string; role: string; phone?: string; profile?: Record<string, unknown> | null }
  executor?: { id: string; name: string; role: string; phone?: string; profile?: Record<string, unknown> | null } | null
  responses: Response[]
  _count: { messages: number }
}

interface Response {
  id: string; message: string; proposedBudget?: number; proposedDeadline?: string
  status: string; createdAt: string
  executor: { id: string; name: string; role: string; profile?: Record<string, unknown> | null }
}

interface Message {
  id: string; content: string; read: boolean; createdAt: string
  sender: { id: string; name: string; role: string; avatar?: string }
}

const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
}

const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }
const responseStatusLabel: Record<string, string> = { PENDING: 'На рассмотрении', ACCEPTED: 'Принят', REJECTED: 'Отклонён' }

export function OrderDetailView() {
  const { selectedOrderId, selectedOrderTab, user, setView, navigateToProfile, addToast } = useAppStore()
  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [tab, setTab] = useState<'info' | 'responses' | 'chat'>(selectedOrderTab as 'info' | 'responses' | 'chat' || 'info')
  const [showResponseForm, setShowResponseForm] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [responseBudget, setResponseBudget] = useState('')
  const [responding, setResponding] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  const loadOrder = useCallback(async () => {
    if (!selectedOrderId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}`)
      const data = await res.json()
      setOrder(data.order)
      // Load messages
      const msgRes = await authFetch(`/api/orders/${selectedOrderId}/messages`)
      const msgData = await msgRes.json()
      setMessages(msgData.messages || [])
    } catch {
      addToast('Ошибка загрузки', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedOrderId])

  useEffect(() => { loadOrder() }, [loadOrder])

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedOrderId) return
    setSending(true)
    try {
      const res = await authFetch(`/api/orders/${selectedOrderId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: chatInput.trim() }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages((prev) => [...prev, data.message])
      }
      setChatInput('')
    } catch {
      addToast('Ошибка отправки', 'error')
    } finally {
      setSending(false)
    }
  }

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
          </div>
        </div>
      </div>

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
            {/* Info tab */}
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

            {/* Responses tab */}
            {tab === 'responses' && (
              <motion.div key="responses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {!isClient && user?.role === 'EXECUTOR' && (
                  <div className="mb-3">
                    {!showResponseForm ? (
                      <div className="flex gap-2">
                        <Button onClick={() => setShowResponseForm(true)} size="sm" className="gap-2">
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

            {/* Chat tab */}
            {tab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="border bg-card">
                  <CardContent className="p-0 flex flex-col" style={{ height: 'min(500px, calc(100dvh - 340px))' }}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                                {!isMine && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">{msg.sender.name}</span>
                                  </div>
                                )}
                                <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                  isMine
                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                    : 'bg-muted rounded-bl-sm'
                                }`}>
                                  {msg.content}
                                </div>
                                <p className={`text-[10px] text-muted-foreground mt-1 ${isMine ? 'text-right' : ''}`}>
                                  {new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    {/* Input */}
                    <div className="p-3 border-t border-border">
                      <div className="flex gap-2">
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
                          disabled={sending || !chatInput.trim()}
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
          </AnimatePresence>
        </div>

        {/* Sidebar */}
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
                    <img src={(isClient ? order.executor : order.client)!.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (isClient ? order.executor : order.client)?.name?.charAt(0) || '?'
                  )}
                </button>
                <div>
                  <button onClick={() => navigateToProfile((isClient ? order.executor : order.client)?.id || '')} className="font-medium text-sm hover:underline">
                    {(isClient ? order.executor : order.client)?.name || 'Не назначен'}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {isClient ? (order.executor ? 'Исполнитель' : 'Не выбран') : order.client.role === 'CLIENT' ? 'Заказчик' : 'Организация'}
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
                <MessageSquare className="w-4 h-4 shrink-0" />{order.responses.length} откликов
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="w-4 h-4 shrink-0" />Создан {new Date(order.createdAt).toLocaleDateString('ru-RU')}
              </div>
            </CardContent>
          </Card>

          {/* Quick chat button for executors */}
          {!isClient && user?.role === 'EXECUTOR' && tab !== 'chat' && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setTab('chat')}>
              <MessageSquare className="w-4 h-4" />
              Написать заказчику
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
