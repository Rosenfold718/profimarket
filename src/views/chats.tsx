'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { MessageSquare, ArrowLeft, MapPin, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Chat {
  orderId: string
  title: string
  status: string
  city?: string
  categoryName?: string
  interlocutor: { id: string; name: string; avatar?: string }
  lastMessage: { content: string; createdAt: string; senderName: string; isMine: boolean; read: boolean }
  totalMessages: number
  unreadCount: number
}

const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
}
const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }

export function ChatsView() {
  const { navigateToOrder, setView, addToast, setUnreadChats } = useAppStore()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch('/api/chats')
        const data = await res.json()
        const chatList: Chat[] = data.chats || []
        setChats(chatList)
        setUnreadChats(chatList.reduce((sum, c) => sum + c.unreadCount, 0))
      } catch {
        addToast('Ошибка загрузки чатов', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [addToast, setUnreadChats])

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    if (mins < 1) return 'Сейчас'
    if (mins < 60) return `${mins} мин`
    if (hours < 24) return `${hours} ч`
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const filtered = chats.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.interlocutor.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  )

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-[family-name:var(--font-display)]">Чаты</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Переписка по заказам · {chats.length} диалог{chats.length === 1 ? '' : chats.length < 5 ? 'а' : 'ов'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setView('orders')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          К заказам
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию заказа или имени..."
          className="pl-10 h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Chat list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MessageSquare className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">
            {search ? 'Чаты не найдены' : 'Нет активных чатов'}
          </p>
          <p className="text-sm mt-1.5">
            {search ? 'Попробуйте изменить запрос' : 'Начните переписку в карточке заказа'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chat, i) => (
            <motion.div
              key={chat.orderId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
            >
              <Card
                className={`cursor-pointer border bg-card transition-all hover:shadow-md ${chat.unreadCount > 0 ? 'border-l-4 border-l-primary' : ''}`}
                onClick={() => navigateToOrder(chat.orderId, 'chat')}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0 overflow-hidden">
                      {chat.interlocutor.avatar ? (
                        <img src={chat.interlocutor.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        chat.interlocutor.name.charAt(0)
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-sm font-semibold truncate">{chat.title}</h3>
                          <Badge variant="outline" className={`text-[11px] px-1.5 py-0 shrink-0 ${statusColor[chat.status]}`}>
                            {statusLabel[chat.status]}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {chat.lastMessage?.createdAt ? formatTime(chat.lastMessage.createdAt) : ''}
                        </span>
                      </div>

                      {/* Interlocutor name */}
                      <p className="text-xs font-medium text-muted-foreground">{chat.interlocutor.name}</p>

                      {/* Last message */}
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-sm text-muted-foreground truncate">
                          {chat.lastMessage ? (
                            <span>
                              {chat.lastMessage.isMine && <span className="text-muted-foreground/60">Вы: </span>}
                              {chat.lastMessage.content}
                            </span>
                          ) : 'Нет сообщений'}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="min-w-[22px] h-[22px] rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center shrink-0 px-1.5">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {chat.categoryName && <span>{chat.categoryName}</span>}
                        {chat.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {chat.city}
                          </span>
                        )}
                        <span>{chat.totalMessages} сообщений</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}