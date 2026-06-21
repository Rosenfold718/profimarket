'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores/use-app-store'
import { authFetch } from '@/lib/fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Search, Send, Loader2, Trash2, Paperclip,
  FileText, Download, X, ArrowLeft, Check, CheckCheck,
  MapPin, Image as ImageIcon,
} from 'lucide-react'
import { useNotificationSound } from '@/lib/notification-sound'
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
interface ChatPeer {
  id: string; name: string; avatar?: string; lastSeenAt?: string
}

interface ChatItem {
  type: 'order' | 'direct'
  orderId?: string
  id?: string // conversation id for direct
  title?: string
  status?: string
  city?: string
  categoryName?: string
  peer: ChatPeer
  interlocutor?: ChatPeer
  lastMessage: { content: string; createdAt: string; isMine: boolean } | null
  updatedAt?: string
  totalMessages?: number
  unreadCount: number
}

interface Msg {
  id: string
  content: string
  senderId: string
  read: boolean
  createdAt: string
  attachmentUrl?: string
  attachmentName?: string
  attachmentType?: string
  attachmentSize?: number
  sender: { id?: string; name: string; avatar?: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatTime(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (mins < 1) return 'Сейчас'
  if (mins < 60) return `${mins} мин`
  if (hours < 24) return `${hours} ч`
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatMsgTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function isOnline(lastSeenAt?: string): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < 60_000
}

function isImageType(mimeType?: string): boolean {
  if (!mimeType) return false
  return mimeType.startsWith('image/')
}

const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
}
const statusLabel: Record<string, string> = { OPEN: 'Открыт', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнен', CANCELLED: 'Отменён' }

const POLL_INTERVAL = 2000
const ONLINE_THRESHOLD = 60_000 // 60 seconds

// ─── Online indicator dot ─────────────────────────────────────────────────────
function OnlineDot({ lastSeenAt }: { lastSeenAt?: string }) {
  const [online, setOnline] = useState(isOnline(lastSeenAt))
  useEffect(() => {
    const timer = setInterval(() => setOnline(isOnline(lastSeenAt)), 15_000)
    return () => clearInterval(timer)
  }, [lastSeenAt])
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} title={online ? 'В сети' : 'Не в сети'} />
  )
}

// ─── Read receipt checkmarks ──────────────────────────────────────────────────
function ReadCheck({ read }: { read: boolean }) {
  if (read) {
    return <CheckCheck className="w-3 h-3 text-sky-500" />
  }
  return <Check className="w-3 h-3 text-muted-foreground/70" />
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ChatsView() {
  const { navigateToOrder, setView, user, addToast, setUnreadChats, selectedConversationId, navigateToProfile } = useAppStore()
  const playSound = useNotificationSound()
  const [items, setItems] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'direct'; id: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const isFirstLoad = useRef(true)
  const itemsRef = useRef<ChatItem[]>([])

  // Which conversation is currently open in the right panel
  const [activeConvId, setActiveConvId] = useState<string | null>(selectedConversationId)

  // Sync with store — handled in the effect above
  // (kept for reference but logic moved to the combined effect)

  // ─── Load chat list ────────────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    try {
      const res = await authFetch('/api/chats')
      const data = await res.json()
      const chats: ChatItem[] = data.chats || []
      // Play sound if new unread messages appeared (only after first load)
      if (!isFirstLoad.current) {
        const prevItems = itemsRef.current
        const prevTotal = prevItems.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        const newTotal = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        if (newTotal > prevTotal) {
          const hasNewUnread = chats.some(c => {
            const prev = prevItems.find(p => p.id === c.id)
            return (c.unreadCount || 0) > (prev?.unreadCount || 0) && c.id !== activeConvId
          })
          if (hasNewUnread) playSound()
        }
      }
      setItems(chats)
      itemsRef.current = chats
      // Exclude active conversation's unread from total — user is viewing it
      const activeUnread = chats.find(c => c.type === 'direct' && c.id === activeConvId)?.unreadCount || 0
      const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0) - activeUnread
      setUnreadChats(Math.max(0, totalUnread))
    } catch {
      if (isFirstLoad.current) addToast('Ошибка загрузки чатов', 'error')
    } finally {
      if (isFirstLoad.current) {
        isFirstLoad.current = false
        setLoading(false)
      }
    }
  }, [addToast, setUnreadChats, activeConvId, playSound])

  useEffect(() => { loadChats() }, [loadChats])
  useEffect(() => {
    const timer = setInterval(loadChats, 5000)
    return () => clearInterval(timer)
  }, [loadChats])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleClick = (item: ChatItem) => {
    if (item.type === 'order') {
      navigateToOrder(item.orderId!, 'chat')
    } else {
      // Immediately clear this conversation's unread count from badge and list
      if (item.unreadCount > 0) {
        setUnreadChats(Math.max(0, useAppStore.getState().unreadChats - item.unreadCount))
        setItems(prev => prev.map(c => c.id === item.id ? { ...c, unreadCount: 0 } : c))
        itemsRef.current = itemsRef.current.map(c => c.id === item.id ? { ...c, unreadCount: 0 } : c)
      }
      setActiveConvId(item.id!)
    }
  }

  // Also handle opening conversation from profile (selectedConversationId)
  useEffect(() => {
    if (selectedConversationId && !activeConvId) {
      // Find the item in the chat list to get its unread count
      const item = items.find(i => i.type === 'direct' && i.id === selectedConversationId)
      if (item && item.unreadCount > 0) {
        setUnreadChats(Math.max(0, useAppStore.getState().unreadChats - item.unreadCount))
        setItems(prev => prev.map(c => c.id === selectedConversationId ? { ...c, unreadCount: 0 } : c))
        itemsRef.current = itemsRef.current.map(c => c.id === selectedConversationId ? { ...c, unreadCount: 0 } : c)
      }
      setActiveConvId(selectedConversationId)
    }
  }, [selectedConversationId])

  const handleDeleteConversation = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/conversations/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.filter(i => i.type !== 'direct' || i.id !== deleteTarget.id))
        if (activeConvId === deleteTarget.id) setActiveConvId(null)
        addToast('Чат удалён', 'success')
      } else {
        const d = await res.json()
        addToast(d.error || 'Ошибка удаления', 'error')
      }
    } catch {
      addToast('Ошибка сети', 'error')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const getSearchText = (item: ChatItem) => {
    const peer = item.type === 'order' ? (item.interlocutor || item.peer) : item.peer
    const title = item.type === 'order' ? item.title : peer.name
    return `${title} ${peer.name}`.toLowerCase()
  }

  const filtered = items.filter(i => !search || getSearchText(i).includes(search.toLowerCase()))

  // ─── Find active conversation peer info ────────────────────────────────────
  const activeItem = items.find(i => i.type === 'direct' && i.id === activeConvId)
  const activePeer = activeItem?.peer

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-5 lg:p-8 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
    </div>
  )

  return (
    <div className="h-full flex overflow-hidden">
      {/* ─── Left panel: Chat list (20%) ─────────────────────────────────── */}
      <div className={`${activeConvId ? 'hidden md:flex' : 'flex'} w-full md:w-[20%] md:min-w-[240px] md:max-w-[340px] flex-col border-r bg-card`}>
        {/* Header */}
        <div className="h-14 px-4 flex items-center border-b shrink-0">
          <h2 className="text-base font-bold font-[family-name:var(--font-display)]">Чаты</h2>
        </div>
        {/* Search */}
        <div className="px-3 py-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-4 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">{search ? 'Чаты не найдены' : 'Нет активных чатов'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((item) => {
                const peer = item.type === 'order' ? (item.interlocutor || item.peer) : item.peer
                const isActive = item.type === 'direct' && item.id === activeConvId
                return (
                  <button
                    key={item.type === 'order' ? item.orderId : item.id}
                    onClick={() => handleClick(item)}
                    className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${isActive ? 'bg-muted' : ''} ${item.unreadCount > 0 ? 'bg-primary/[0.03]' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0 self-center">
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden">
                        {peer.avatar ? (
                          <img src={peer.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          peer.name?.charAt(0) || '?'
                        )}
                      </div>
                      <OnlineDot lastSeenAt={peer.lastSeenAt} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-baseline justify-between gap-2 min-h-[18px]">
                        <span className="text-[13px] font-medium truncate leading-tight">
                          {item.type === 'order' ? item.title : peer.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0 leading-none">
                          {formatTime(item.type === 'order' ? (item.lastMessage?.createdAt || '') : (item.updatedAt || ''))}
                        </span>
                      </div>
                      {item.type === 'order' ? (
                        <div className="flex items-center gap-1.5 min-h-[16px]">
                          {item.status && (
                            <span className={`text-[10px] px-1.5 py-[1px] rounded leading-none shrink-0 ${statusColor[item.status] || 'text-muted-foreground'}`}>
                              {statusLabel[item.status]}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground truncate">{peer.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {item.lastMessage ? (
                              <span>
                                <span className="text-muted-foreground/60">{item.lastMessage.isMine ? 'Вы' : peer.name}: </span>
                                {item.lastMessage.content}
                              </span>
                            ) : ''}
                          </span>
                          {item.unreadCount > 0 && (
                            <span className="min-w-[20px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center shrink-0 px-1.5 leading-none">
                              {item.unreadCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1.5 min-h-[16px]">
                          <p className="text-xs text-muted-foreground truncate">
                            {item.lastMessage ? (
                              <span>
                                <span className="text-muted-foreground/60">{item.lastMessage.isMine ? 'Вы' : item.peer.name}: </span>
                                {item.lastMessage.content}
                              </span>
                            ) : 'Нет сообщений'}
                          </p>
                          {item.unreadCount > 0 && (
                            <span className="min-w-[20px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center shrink-0 px-1.5 leading-none">
                              {item.unreadCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right panel: Conversation (80%) ─────────────────────────────── */}
      <div className={`${!activeConvId ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0`}>
        {activeConvId && activePeer ? (
          <ConversationPanel
            key={activeConvId}
            conversationId={activeConvId}
            peer={activePeer}
            onBack={() => setActiveConvId(null)}
            onDelete={() => setDeleteTarget({ type: 'direct', id: activeConvId })}
            onRefreshChats={loadChats}
          />
        ) : activeConvId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-15" />
              <p className="text-sm font-medium">Выберите чат</p>
              <p className="text-xs mt-1 opacity-70">или начните переписку из профиля пользователя</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
            <AlertDialogDescription>Все сообщения будут удалены безвозвратно.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Conversation panel (right side) ─────────────────────────────────────────
interface ConversationPanelProps {
  conversationId: string
  peer: ChatPeer
  onBack: () => void
  onDelete: () => void
  onRefreshChats: () => void
}

function ConversationPanel({ conversationId, peer, onBack, onDelete, onRefreshChats }: ConversationPanelProps) {
  const { user, addToast, setUnreadChats, navigateToProfile } = useAppStore()
  const playSound = useNotificationSound()
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [peerInfo, setPeerInfo] = useState<ChatPeer>(peer)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)
  const prevCountRef = useRef(0)
  const messagesRef = useRef<Msg[]>([])

  // Keep ref in sync synchronously
  const updateMessages = useCallback((updater: Msg[] | ((prev: Msg[]) => Msg[])) => {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      messagesRef.current = next
      return next
    })
  }, [])

  // ─── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (useSince = false) => {
    try {
      let url = `/api/conversations/${conversationId}/messages`
      if (useSince && messagesRef.current.length > 0) {
        const newestTime = messagesRef.current[messagesRef.current.length - 1]?.createdAt
        if (newestTime) url += `?since=${encodeURIComponent(newestTime)}`
      }

      const res = await authFetch(url)
      const data = await res.json()
      const fetchedMsgs: Msg[] = data.messages || []

      if (useSince) {
        if (fetchedMsgs.length > 0) {
          const existingIds = new Set(messagesRef.current.map(m => m.id))
          const fresh = fetchedMsgs.filter(m => !existingIds.has(m.id))
          if (fresh.length > 0) {
            // Play sound for messages from others
            const fromOthers = fresh.filter(m => m.senderId !== user?.id)
            if (fromOthers.length > 0) playSound()
            updateMessages(prev => {
              const merged = [...prev, ...fresh].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              messagesRef.current = merged
              return merged
            })
            if (wasAtBottomRef.current) {
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            }
            // Update peer's lastSeenAt from fresh messages (in case they sent something)
            onRefreshChats()
          }
        }
      } else {
        const sorted = fetchedMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        updateMessages(sorted)

        // Mark unread messages from others as read
        const unreadFromOthers = sorted.filter(m => !m.read && m.senderId !== user?.id).length
        if (unreadFromOthers > 0) {
          authFetch(`/api/conversations/${conversationId}/messages`, { method: 'PATCH' })
            .then(() => {
              setUnreadChats(Math.max(0, useAppStore.getState().unreadChats - unreadFromOthers))
              onRefreshChats()
            })
            .catch(() => {})
        }
      }
    } catch {
      if (!useSince) addToast('Ошибка загрузки сообщений', 'error')
    } finally {
      if (!useSince) setLoading(false)
    }
  }, [conversationId, addToast, setUnreadChats, updateMessages, onRefreshChats, user?.id, playSound])

  // Initial load
  useEffect(() => {
    updateMessages([])
    setLoading(true)
    setPeerInfo(peer)
    loadMessages(false)
  }, [conversationId])

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

  // Polling
  useEffect(() => {
    if (loading || !conversationId) return
    const timer = setInterval(() => loadMessages(true), POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [conversationId, loading, loadMessages])

  // ─── File handling ────────────────────────────────────────────────────────
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

  // ─── Send message ─────────────────────────────────────────────────────────
  const send = async () => {
    if ((!text.trim() && !attachedFile) || sending) return
    setSending(true)
    try {
      let res: Response

      if (attachedFile) {
        const formData = new FormData()
        if (text.trim()) formData.append('content', text.trim())
        formData.append('file', attachedFile)
        res = await authFetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await authFetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: text.trim() }),
        })
      }

      const data = await res.json()
      if (res.ok) {
        updateMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          const merged = [...prev, data.message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          messagesRef.current = merged
          return merged
        })
        setText('')
        removeFile()
        onRefreshChats()
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

  // ─── Delete message ───────────────────────────────────────────────────────
  const deleteMessage = async (msgId: string) => {
    setDeleting(true)
    try {
      const res = await authFetch(`/api/conversations/${conversationId}/messages/${msgId}`, { method: 'DELETE' })
      if (res.ok) {
        updateMessages(prev => prev.filter(m => m.id !== msgId))
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0 bg-background">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <button
          onClick={() => navigateToProfile(peer.id)}
          className="flex items-center gap-2.5 min-w-0 flex-1"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
              {peerInfo.avatar ? (
                <img src={peerInfo.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                peerInfo.name?.charAt(0) || '?'
              )}
            </div>
            <OnlineDot lastSeenAt={peerInfo.lastSeenAt} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold truncate leading-tight">{peerInfo.name}</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {isOnline(peerInfo.lastSeenAt) ? 'В сети' : peerInfo.lastSeenAt ? `Был(а) ${formatTime(peerInfo.lastSeenAt)}` : 'Не в сети'}
            </p>
          </div>
        </button>
        <Button
          variant="ghost" size="icon"
          onClick={onDelete}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Удалить чат"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-15" />
            <p className="text-sm font-medium">Нет сообщений</p>
            <p className="text-xs mt-1">Начните переписку</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.id
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
                className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
              >
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold shrink-0 overflow-hidden self-end">
                    {msg.sender?.avatar ? (
                      <img src={msg.sender.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      msg.sender?.name?.charAt(0) || '?'
                    )}
                  </div>
                )}
                <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Name for others */}
                  {!isMine && msg.sender && (
                    <p className="text-[11px] font-medium text-muted-foreground mb-0.5 px-1">{msg.sender.name}</p>
                  )}
                  {/* Bubble */}
                  <div className={`relative group rounded-2xl px-3.5 py-2.5 text-sm ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  }`}>
                    {/* Image attachment preview */}
                    {msg.attachmentUrl && isImageType(msg.attachmentType) && (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mb-2 -mx-1 -mt-1">
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
                        className={`flex items-center gap-2.5 p-2 rounded-lg mb-2 transition-colors ${
                          isMine ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25' : 'bg-background/60 hover:bg-background/80'
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
                    {/* Delete button (own messages) */}
                    {isMine && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteMsgId(msg.id) }}
                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-background shadow-sm border text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Удалить сообщение"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {/* Time + read receipt */}
                  <div className={`flex items-center gap-1 mt-0.5 h-4 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] text-muted-foreground leading-none">{formatMsgTime(msg.createdAt)}</span>
                    {isMine && <ReadCheck read={msg.read} />}
                  </div>
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

      {/* Input */}
      <div className="border-t px-3 py-2.5 shrink-0 bg-background">
        {attachedFile && (
          <div className="max-w-3xl mx-auto mb-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
              <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
              {attachedFile.type.startsWith('image/') && (
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
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
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
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            aria-label="Прикрепить файл"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            placeholder="Введите сообщение..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            className="h-10 text-sm rounded-lg"
            disabled={sending}
          />
          <Button
            onClick={send}
            disabled={sending || (!text.trim() && !attachedFile)}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}