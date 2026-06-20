'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
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

interface Msg {
  id: string
  content: string
  senderId: string
  read: boolean
  createdAt: string
  sender: { name: string; avatar?: string } | null
}

const POLL_INTERVAL = 2000

export function ConversationView() {
  const { selectedConversationId, setView, user, addToast } = useAppStore()
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [showDeleteChat, setShowDeleteChat] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)
  const prevCountRef = useRef(0)
  const messagesRef = useRef<Msg[]>([])

  // Keep ref in sync
  useEffect(() => { messagesRef.current = messages }, [messages])

  const loadMessages = useCallback(async (useSince = false) => {
    if (!selectedConversationId) return
    try {
      let url = `/api/conversations/${selectedConversationId}/messages`
      const currentMsgs = messagesRef.current
      if (useSince && currentMsgs.length > 0) {
        const newestTime = currentMsgs[currentMsgs.length - 1]?.createdAt
        if (newestTime) url += `?since=${encodeURIComponent(newestTime)}`
      }

      const res = await authFetch(url)
      const data = await res.json()
      const fetchedMsgs: Msg[] = data.messages || []

      if (useSince) {
        if (fetchedMsgs.length > 0) {
          const existingIds = new Set(currentMsgs.map(m => m.id))
          const fresh = fetchedMsgs.filter(m => !existingIds.has(m.id))
          if (fresh.length > 0) {
            setMessages(prev => {
              const merged = [...prev, ...fresh]
              merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              return merged
            })
            if (wasAtBottomRef.current) {
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            }
          }
        }
      } else {
        setMessages(fetchedMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
        authFetch(`/api/conversations/${selectedConversationId}/messages`, { method: 'PATCH' })
      }
    } catch {
      if (!useSince) addToast('Ошибка загрузки сообщений', 'error')
    } finally {
      if (!useSince) setLoading(false)
    }
  }, [selectedConversationId, addToast])

  // Initial load
  useEffect(() => {
    setMessages([])
    setLoading(true)
    loadMessages(false)
  }, [selectedConversationId, loadMessages])

  // Track scroll position
  useEffect(() => {
    const container = bottomRef.current?.parentElement
    if (!container) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 60
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [loading])

  // Scroll on new messages
  useEffect(() => {
    if (messages.length > 0 && messages.length !== prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevCountRef.current === 0 ? 'auto' : 'smooth' })
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  // Polling: check for new messages every 2s (stable reference)
  useEffect(() => {
    if (loading || !selectedConversationId) return

    const timer = setInterval(() => {
      loadMessages(true)
    }, POLL_INTERVAL)

    return () => clearInterval(timer)
  }, [selectedConversationId, loading, loadMessages])

  const send = async () => {
    if (!text.trim() || sending || !selectedConversationId) return
    setSending(true)
    try {
      const res = await authFetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(prev => {
          const merged = [...prev, data.message]
          merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          return merged
        })
        setText('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        addToast(data.error || 'Ошибка отправки', 'error')
      }
    } catch {
      addToast('Ошибка сети', 'error')
    } finally {
      setSending(false)
    }
  }

  const deleteMessage = async (msgId: string) => {
    if (!selectedConversationId) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/conversations/${selectedConversationId}/messages/${msgId}`, { method: 'DELETE' })
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId))
      } else {
        const d = await res.json()
        addToast(d.error || 'Ошибка удаления', 'error')
      }
    } catch {
      addToast('Ошибка сети', 'error')
    } finally {
      setDeleting(false)
      setDeleteMsgId(null)
    }
  }

  const deleteConversation = async () => {
    if (!selectedConversationId) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/conversations/${selectedConversationId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('Чат удалён', 'success')
        setView('chats')
      } else {
        const d = await res.json()
        addToast(d.error || 'Ошибка удаления', 'error')
      }
    } catch {
      addToast('Ошибка сети', 'error')
    } finally {
      setDeleting(false)
      setShowDeleteChat(false)
    }
  }

  const formatTime = (d: string) => {
    const date = new Date(d)
    return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (!selectedConversationId) {
    return (
      <div className="p-5 lg:p-8">
        <Button variant="ghost" onClick={() => setView('chats')} className="gap-2"><ArrowLeft className="w-4 h-4" />Назад</Button>
        <p className="text-muted-foreground mt-4">Диалог не выбран</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setView('chats')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost" size="sm"
          onClick={() => setShowDeleteChat(true)}
          className="gap-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Удалить чат</span>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Нет сообщений</p>
            <p className="text-sm mt-1">Начните переписку</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.id
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
              >
                {!isMine && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0 overflow-hidden">
                    {msg.sender?.avatar ? (
                      <img src={msg.sender.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      msg.sender?.name?.charAt(0) || '?'
                    )}
                  </div>
                )}
                <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                    {!isMine && msg.sender && (
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">{msg.sender.name}</p>
                    )}
                    {isMine && (
                      <button
                        onClick={() => setDeleteMsgId(msg.id)}
                        className="p-0.5 rounded text-primary-foreground/40 hover:text-primary-foreground/80 transition-colors"
                        aria-label="Удалить сообщение"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                  <p className={`text-[11px] text-muted-foreground mt-0.5 ${isMine ? 'text-right' : ''}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Delete message confirmation */}
      <AlertDialog open={!!deleteMsgId} onOpenChange={(open) => !open && setDeleteMsgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сообщение?</AlertDialogTitle>
            <AlertDialogDescription>Сообщение будет удалено безвозвратно.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMsgId && deleteMessage(deleteMsgId)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete chat confirmation */}
      <AlertDialog open={showDeleteChat} onOpenChange={setShowDeleteChat}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
            <AlertDialogDescription>
              Все сообщения будут удалены безвозвратно. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConversation}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            placeholder="Введите сообщение..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            className="h-11"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="h-11 w-11 shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}