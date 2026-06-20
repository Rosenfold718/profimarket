'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { MessageSquare, Search, ArrowLeft, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface OrderChat {
  type: 'order'
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

interface DirectChat {
  type: 'direct'
  id: string
  peer: { id: string; name: string; avatar?: string }
  lastMessage: { content: string; createdAt: string; isMine: boolean } | null
  updatedAt: string
  unreadCount: number
}

type ChatItem = OrderChat | DirectChat

const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
}
const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }

export function ChatsView() {
  const { navigateToOrder, navigateToConversation, setView, addToast, setUnreadChats } = useAppStore()
  const [items, setItems] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [chatsRes, convsRes] = await Promise.all([
          authFetch('/api/chats'),
          authFetch('/api/conversations'),
        ])
        const chatsData = await chatsRes.json()
        const convsData = await convsRes.json()

        const orderChats: OrderChat[] = (chatsData.chats || []).map((c: Record<string, unknown>) => ({
          type: 'order' as const,
          orderId: c.orderId,
          title: c.title,
          status: c.status,
          city: c.city,
          categoryName: c.categoryName,
          interlocutor: c.interlocutor,
          lastMessage: c.lastMessage,
          totalMessages: c.totalMessages,
          unreadCount: c.unreadCount,
        }))

        const directChats: DirectChat[] = (convsData.conversations || []).map((c: Record<string, unknown>) => ({
          type: 'direct' as const,
          id: c.id,
          peer: c.peer,
          lastMessage: c.lastMessage,
          updatedAt: c.updatedAt,
          unreadCount: c.unreadCount,
        }))

        // Sort by last activity
        const all: ChatItem[] = [...orderChats, ...directChats].sort((a, b) => {
          const timeA = a.type === 'order' ? a.lastMessage?.createdAt : a.updatedAt
          const timeB = b.type === 'order' ? b.lastMessage?.createdAt : b.updatedAt
          return new Date(timeB || 0).getTime() - new Date(timeA || 0).getTime()
        })

        setItems(all)
        const totalUnread = [...orderChats, ...directChats].reduce((sum: number, c: { unreadCount: number }) => sum + c.unreadCount, 0)
        setUnreadChats(totalUnread)
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

  const handleClick = (item: ChatItem) => {
    if (item.type === 'order') {
      navigateToOrder(item.orderId, 'chat')
    } else {
      navigateToConversation(item.id)
    }
  }

  const getSearchText = (item: ChatItem) => {
    if (item.type === 'order') return `${item.title} ${item.interlocutor.name}`.toLowerCase()
    return item.peer.name.toLowerCase()
  }

  const filtered = items.filter(i => !search || getSearchText(i).includes(search.toLowerCase()))

  const total = items.length

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
            {total} диалог{total === 1 ? '' : total < 5 ? 'а' : 'ов'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск..."
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
            {search ? 'Попробуйте изменить запрос' : 'Напишите пользователю из его профиля или начните переписку в заказе'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <motion.div
              key={item.type === 'order' ? item.orderId : item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
            >
              <Card
                className={`cursor-pointer border bg-card transition-all hover:shadow-md ${item.unreadCount > 0 ? 'border-l-4 border-l-primary' : ''}`}
                onClick={() => handleClick(item)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0 overflow-hidden">
                      {(() => {
                        const avatar = item.type === 'order' ? item.interlocutor.avatar : item.peer.avatar
                        const name = item.type === 'order' ? item.interlocutor.name : item.peer.name
                        return avatar ? (
                          <img src={avatar} alt="" className="w-full h-full object-cover" />
                        ) : name?.charAt(0) || '?'
                      })()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-sm font-semibold truncate">
                            {item.type === 'order' ? item.title : item.peer.name}
                          </h3>
                          {item.type === 'order' && (
                            <Badge variant="outline" className={`text-[11px] px-1.5 py-0 shrink-0 ${statusColor[item.status]}`}>
                              {statusLabel[item.status]}
                            </Badge>
                          )}
                          {item.type === 'direct' && (
                            <Badge variant="secondary" className="text-[11px] px-1.5 py-0 shrink-0">Личное</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTime(item.type === 'order' ? (item.lastMessage?.createdAt || '') : item.updatedAt)}
                        </span>
                      </div>

                      {/* Name for order chats, last message for direct */}
                      {item.type === 'order' && (
                        <p className="text-xs font-medium text-muted-foreground">{item.interlocutor.name}</p>
                      )}

                      {/* Last message */}
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-sm text-muted-foreground truncate">
                          {item.lastMessage ? (
                            <span>
                              {item.lastMessage.isMine && <span className="text-muted-foreground/60">Вы: </span>}
                              {item.lastMessage.content}
                            </span>
                          ) : 'Нет сообщений'}
                        </p>
                        {item.unreadCount > 0 && (
                          <span className="min-w-[22px] h-[22px] rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center shrink-0 px-1.5">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Meta for order chats */}
                      {item.type === 'order' && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {item.categoryName && <span>{item.categoryName}</span>}
                          {item.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {item.city}
                            </span>
                          )}
                          <span>{item.totalMessages} сообщ.</span>
                        </div>
                      )}
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