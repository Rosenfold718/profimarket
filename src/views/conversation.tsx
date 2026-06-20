'use client'
import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface Msg {
  id: string
  content: string
  senderId: string
  read: boolean
  createdAt: string
  sender: { name: string; avatar?: string } | null
}

export function ConversationView() {
  const { selectedConversationId, setView, user, addToast } = useAppStore()
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    if (!selectedConversationId) return
    try {
      const res = await authFetch(`/api/conversations/${selectedConversationId}/messages`)
      const data = await res.json()
      setMessages(data.messages || [])
      // Mark as read
      authFetch(`/api/conversations/${selectedConversationId}/messages`, { method: 'PATCH' })
    } catch {
      addToast('Ошибка загрузки сообщений', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [selectedConversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        setMessages(prev => [data.message, ...prev])
        setText('')
      } else {
        addToast(data.error || 'Ошибка отправки', 'error')
      }
    } catch {
      addToast('Ошибка сети', 'error')
    } finally {
      setSending(false)
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
          messages.map((msg, i) => {
            const isMine = msg.senderId === user?.id
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.01, duration: 0.15 }}
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
                  {!isMine && msg.sender && (
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">{msg.sender.name}</p>
                  )}
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