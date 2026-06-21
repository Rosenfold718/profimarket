'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { authFetch } from '@/lib/fetch'
import { useAppStore } from '@/stores/use-app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Users, MessageSquare, Trash2, Search, Shield,
  CheckCircle2, Loader2, BarChart3, Eye, EyeOff, Copy, Check,
  ChevronDown, ChevronUp, ChevronRight, ArrowLeft, Inbox, Send, FileText, Briefcase,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; clients: number; executors: number; admins: number }
  orders: { total: number; open: number; inProgress: number; completed: number; cancelled: number }
  messages: { total: number }
  responses: { total: number }
  conversations: { total: number }
}

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  avatar: string | null
  passwordHash: string
  lastSeenAt: string | null
  createdAt: string
  profile: { company: string | null; city: string | null; rating: number; completedOrders: number; specializations: string } | null
  _count: { clientOrders: number; executorOrders: number; responses: number; sentMessages: number }
}

interface ActivityEntry {
  id: string
  userId: string
  action: string
  details: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  user: { name: string | null; email: string | null }
}

interface ConversationEntry {
  id: string
  title: string
  type: 'order' | 'direct'
  lastMessage: string | null
  messageCount: number
  updatedAt: string
}

interface MessageEntry {
  id: string
  content: string
  senderId: string
  read: boolean
  createdAt: string
  attachmentUrl: string | null
  attachmentName: string | null
  sender: { name: string | null; avatar: string | null }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const roleBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ADMIN: { label: 'Админ', variant: 'destructive' },
  CLIENT: { label: 'Заказчик', variant: 'default' },
  EXECUTOR: { label: 'Исполнитель', variant: 'secondary' },
}

const actionLabels: Record<string, { label: string; icon: string }> = {
  register: { label: 'Регистрация', icon: '🆕' },
  login: { label: 'Вход', icon: '🔑' },
  create_order: { label: 'Создание заказа', icon: '📋' },
  send_response: { label: 'Отправка отклика', icon: '📨' },
  accept_response: { label: 'Принятие отклика', icon: '✅' },
  reject_response: { label: 'Отклонение отклика', icon: '❌' },
  send_message: { label: 'Отправка сообщения', icon: '💬' },
  update_profile: { label: 'Обновление профиля', icon: '✏️' },
  view_order: { label: 'Просмотр заказа', icon: '👁️' },
  view_chats: { label: 'Просмотр чатов', icon: '🗨️' },
  view_profile: { label: 'Просмотр профиля', icon: '👤' },
}

const allActions = Object.keys(actionLabels)

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), 'dd MMM yyyy, HH:mm', { locale: ru })
  } catch {
    return dateStr
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PasswordCell({ hash }: { hash: string }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(hash).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-mono max-w-[120px] truncate" title={hash}>
        {visible ? hash : '••••••••••••'}
      </span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  )
}

function DeleteConfirmButton({ onConfirm, description }: {
  onConfirm: () => void; description: string
}) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false) }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-destructive text-white hover:bg-destructive/90">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AdminView() {
  const { addToast } = useAppStore()

  // Stats
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Users tab
  const [usersList, setUsersList] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userTotalPages, setUserTotalPages] = useState(1)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Expanded user detail sub-data
  const [userConversations, setUserConversations] = useState<ConversationEntry[]>([])
  const [userActivity, setUserActivity] = useState<ActivityEntry[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Chats tab
  const [chatUsers, setChatUsers] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [chatSearch, setChatSearch] = useState('')
  const [chatUserId, setChatUserId] = useState<string | null>(null)
  const [chatConvs, setChatConvs] = useState<ConversationEntry[]>([])
  const [chatConvId, setChatConvId] = useState<string | null>(null)
  const [chatConvType, setChatConvType] = useState<'order' | 'direct'>('order')
  const [chatMessages, setChatMessages] = useState<MessageEntry[]>([])
  const [chatConvTitle, setChatConvTitle] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)

  // Analytics tab
  const [activityList, setActivityList] = useState<ActivityEntry[]>([])
  const [activityPage, setActivityPage] = useState(1)
  const [activityTotalPages, setActivityTotalPages] = useState(1)
  const [activityFilter, setActivityFilter] = useState<string | null>(null)
  const [loadingActivity, setLoadingActivity] = useState(false)

  // ─── Fetchers ─────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin')
      if (res.status === 403) { addToast('Доступ запрещён', 'error'); return }
      const data = await res.json()
      setStats(data)
    } catch { addToast('Ошибка загрузки статистики', 'error') }
    finally { setLoadingStats(false) }
  }, [addToast])

  const fetchUsers = useCallback(async (page: number, search: string) => {
    setLoadingUsers(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const res = await authFetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsersList(data.users)
      setUserTotalPages(data.pagination.totalPages)
    } catch { addToast('Ошибка загрузки пользователей', 'error') }
    finally { setLoadingUsers(false) }
  }, [addToast])

  const fetchUserDetail = useCallback(async (userId: string) => {
    setLoadingDetail(true)
    try {
      const [convRes, actRes] = await Promise.all([
        authFetch(`/api/admin/users/${userId}/conversations`),
        authFetch(`/api/admin/activity?userId=${userId}&limit=10`),
      ])
      if (convRes.ok) {
        const convData = await convRes.json()
        setUserConversations(convData.conversations || [])
      }
      if (actRes.ok) {
        const actData = await actRes.json()
        setUserActivity(actData.activities || [])
      }
    } catch {}
    finally { setLoadingDetail(false) }
  }, [])

  const fetchChatUsers = useCallback(async (search: string) => {
    setLoadingChat(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search) params.set('search', search)
      const res = await authFetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChatUsers(data.users.map((u: UserRow) => ({ id: u.id, name: u.name, role: u.role })))
    } catch {}
    finally { setLoadingChat(false) }
  }, [])

  const fetchChatConvs = useCallback(async (userId: string) => {
    setLoadingChat(true)
    try {
      const res = await authFetch(`/api/admin/users/${userId}/conversations`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChatConvs(data.conversations || [])
    } catch {}
    finally { setLoadingChat(false) }
  }, [])

  const fetchChatMessages = useCallback(async (userId: string, conv: ConversationEntry) => {
    setLoadingChat(true)
    try {
      const params = new URLSearchParams()
      if (conv.type === 'order') params.set('orderId', conv.id)
      else params.set('conversationId', conv.id)
      const res = await authFetch(`/api/admin/users/${userId}/messages?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChatMessages(data.messages || [])
      setChatConvTitle(conv.title)
    } catch {}
    finally { setLoadingChat(false) }
  }, [])

  const fetchActivity = useCallback(async (page: number, action?: string | null, userId?: string) => {
    setLoadingActivity(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (action) params.set('action', action)
      if (userId) params.set('userId', userId)
      const res = await authFetch(`/api/admin/activity?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setActivityList(data.activities || [])
      setActivityTotalPages(data.pagination.totalPages)
    } catch {}
    finally { setLoadingActivity(false) }
  }, [])

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats()
    fetchUsers(1, '')
    fetchChatUsers('')
    fetchActivity(1)
  }, [fetchStats, fetchUsers, fetchChatUsers, fetchActivity])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSearchUsers = () => { setUserPage(1); fetchUsers(1, userSearch) }

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); addToast(data.error || 'Ошибка удаления', 'error'); return }
      addToast(`Пользователь "${userName}" удалён`, 'success')
      fetchStats()
      fetchUsers(userPage, userSearch)
      if (expandedUserId === userId) setExpandedUserId(null)
    } catch { addToast('Ошибка удаления пользователя', 'error') }
  }

  const handleExpandUser = (userId: string) => {
    if (expandedUserId === userId) { setExpandedUserId(null); return }
    setExpandedUserId(userId)
    fetchUserDetail(userId)
  }

  const handleSearchChatUsers = () => { fetchChatUsers(chatSearch) }

  const handleSelectChatUser = (userId: string) => {
    setChatUserId(userId)
    setChatConvId(null)
    setChatMessages([])
    fetchChatConvs(userId)
  }

  const handleSelectConversation = (conv: ConversationEntry) => {
    setChatConvId(conv.id)
    setChatConvType(conv.type)
    if (chatUserId) fetchChatMessages(chatUserId, conv)
  }

  const handleChatBack = () => {
    if (chatConvId) { setChatConvId(null); setChatMessages([]); return }
    if (chatUserId) { setChatUserId(null); setChatConvs([]); return }
  }

  const handleActivityFilter = (action: string | null) => {
    setActivityFilter(action)
    setActivityPage(1)
    fetchActivity(1, action)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Админ-панель</h1>
          <p className="text-sm text-muted-foreground">Управление платформой ProfiMarket</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" />Пользователи</TabsTrigger>
          <TabsTrigger value="chats" className="gap-2"><MessageSquare className="w-4 h-4" />Чаты</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="w-4 h-4" />Аналитика</TabsTrigger>
        </TabsList>

        {/* ═══════ TAB 1: Users ═══════ */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени или email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearchUsers} variant="secondary">Найти</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-y-auto">
                {loadingUsers ? (
                  <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : usersList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Пользователи не найдены</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Имя</TableHead>
                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                        <TableHead>Пароль</TableHead>
                        <TableHead className="hidden md:table-cell">Телефон</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead className="hidden lg:table-cell">Город</TableHead>
                        <TableHead className="hidden lg:table-cell">Компания</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersList.map((u) => {
                        const rb = roleBadgeMap[u.role] || { label: u.role, variant: 'outline' as const }
                        const isExpanded = expandedUserId === u.id
                        const lastAction = userActivity.find(a => a.userId === u.id)
                        return (
                          <Fragment key={u.id}>
                            <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => handleExpandUser(u.id)}>
                              <TableCell className="w-8">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 overflow-hidden">
                                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate text-sm">{u.name}</p>
                                    <p className="text-xs text-muted-foreground sm:hidden truncate">{u.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
                              <TableCell><PasswordCell hash={u.passwordHash} /></TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.phone || '—'}</TableCell>
                              <TableCell><Badge variant={rb.variant}>{rb.label}</Badge></TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{u.profile?.city || '—'}</TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{u.profile?.company || '—'}</TableCell>
                              <TableCell>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <DeleteConfirmButton
                                    onConfirm={() => handleDeleteUser(u.id, u.name)}
                                    description={`Удалить "${u.name}" (${u.email})? Все данные будут удалены безвозвратно.`}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={9} className="p-0">
                                  <div className="bg-muted/30 border-t border-b p-4 space-y-4">
                                    {loadingDetail ? (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Загрузка...</div>
                                    ) : (
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Left column: Info + Conversations */}
                                        <div className="space-y-4">
                                          {/* Full user info */}
                                          <Card>
                                            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Информация</CardTitle></CardHeader>
                                            <CardContent className="text-sm space-y-1">
                                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                <span className="text-muted-foreground">ID:</span><span className="font-mono text-xs">{u.id.slice(0, 16)}…</span>
                                                <span className="text-muted-foreground">Регистрация:</span><span>{formatDate(u.createdAt)}</span>
                                                <span className="text-muted-foreground">Последний визит:</span><span>{u.lastSeenAt ? formatDate(u.lastSeenAt) : '—'}</span>
                                                <span className="text-muted-foreground">Пароль (хеш):</span><span className="font-mono text-xs break-all">{u.passwordHash}</span>
                                              </div>
                                            </CardContent>
                                          </Card>

                                          {/* Profile data */}
                                          <Card>
                                            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Профиль</CardTitle></CardHeader>
                                            <CardContent className="text-sm space-y-1">
                                              {u.profile ? (
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                  <span className="text-muted-foreground">Компания:</span><span>{u.profile.company || '—'}</span>
                                                  <span className="text-muted-foreground">Город:</span><span>{u.profile.city || '—'}</span>
                                                  <span className="text-muted-foreground">Рейтинг:</span><span>{u.profile.rating}</span>
                                                  <span className="text-muted-foreground">Выполнено заказов:</span><span>{u.profile.completedOrders}</span>
                                                  <span className="text-muted-foreground">Специализации:</span>
                                                  <span className="flex flex-wrap gap-1">
                                                    {(() => {
                                                      try {
                                                        const specs = JSON.parse(u.profile.specializations || '[]')
                                                        return Array.isArray(specs) ? specs.map((s: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>) : null
                                                      } catch { return <span>—</span> }
                                                    })()}
                                                  </span>
                                                </div>
                                              ) : <p className="text-muted-foreground">Профиль не заполнен</p>}
                                            </CardContent>
                                          </Card>

                                          {/* Stats row */}
                                          <Card>
                                            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Статистика</CardTitle></CardHeader>
                                            <CardContent>
                                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                                <div><p className="text-lg font-bold">{u._count.clientOrders}</p><p className="text-xs text-muted-foreground">Заказы клиента</p></div>
                                                <div><p className="text-lg font-bold">{u._count.executorOrders}</p><p className="text-xs text-muted-foreground">Заказы исполнителя</p></div>
                                                <div><p className="text-lg font-bold">{u._count.responses}</p><p className="text-xs text-muted-foreground">Отклики</p></div>
                                                <div><p className="text-lg font-bold">{u._count.sentMessages}</p><p className="text-xs text-muted-foreground">Сообщения</p></div>
                                              </div>
                                            </CardContent>
                                          </Card>

                                          {/* Conversations */}
                                          <Card>
                                            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Переписки ({userConversations.length})</CardTitle></CardHeader>
                                            <CardContent>
                                              <div className="max-h-48 overflow-y-auto space-y-2">
                                                {userConversations.length === 0 ? (
                                                  <p className="text-sm text-muted-foreground">Нет переписок</p>
                                                ) : userConversations.map((c) => (
                                                  <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-background text-sm">
                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-center gap-2">
                                                        <Badge variant={c.type === 'order' ? 'default' : 'secondary'} className="text-xs shrink-0">
                                                          {c.type === 'order' ? 'Заказ' : 'Личное'}
                                                        </Badge>
                                                        <span className="truncate font-medium">{c.title}</span>
                                                      </div>
                                                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage || 'Нет сообщений'}</p>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{c.messageCount} сооб.</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </CardContent>
                                          </Card>
                                        </div>

                                        {/* Right column: Activity log */}
                                        <Card>
                                          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Активность</CardTitle></CardHeader>
                                          <CardContent>
                                            <div className="max-h-[400px] overflow-y-auto space-y-2">
                                              {userActivity.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">Нет записей</p>
                                              ) : userActivity.map((a) => {
                                                const al = actionLabels[a.action] || { label: a.action, icon: '📌' }
                                                return (
                                                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-background text-sm">
                                                    <span className="text-base shrink-0">{al.icon}</span>
                                                    <div className="min-w-0 flex-1">
                                                      <p><span className="font-medium">{al.label}</span></p>
                                                      {a.details && <p className="text-xs text-muted-foreground truncate">{JSON.stringify(a.details)}</p>}
                                                      <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)} · {a.ip || '—'}</p>
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          {userTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={userPage <= 1} onClick={() => { const p = userPage - 1; setUserPage(p); fetchUsers(p, userSearch) }}>Назад</Button>
              <span className="text-sm text-muted-foreground">{userPage} / {userTotalPages}</span>
              <Button variant="outline" size="sm" disabled={userPage >= userTotalPages} onClick={() => { const p = userPage + 1; setUserPage(p); fetchUsers(p, userSearch) }}>Далее</Button>
            </div>
          )}
        </TabsContent>

        {/* ═══════ TAB 2: Chats ═══════ */}
        <TabsContent value="chats" className="mt-4">
          <Card className="min-h-[500px]">
            <CardContent className="p-0 h-full">
              <div className="flex h-[500px]">
                {/* Left panel: Users / Conversations list */}
                <div className="w-full sm:w-80 border-r flex flex-col shrink-0">
                  <div className="p-3 border-b flex items-center gap-2">
                    {(chatUserId || chatConvId) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleChatBack}>
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="relative flex-1">
                      {!chatUserId && (
                        <>
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Поиск пользователей..."
                            value={chatSearch}
                            onChange={(e) => setChatSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchChatUsers()}
                            className="pl-9 h-8 text-sm"
                          />
                        </>
                      )}
                      {chatUserId && !chatConvId && (
                        <p className="text-sm font-medium truncate">
                          {chatUsers.find(u => u.id === chatUserId)?.name || 'Пользователь'}
                          <span className="text-muted-foreground font-normal ml-1">— переписки</span>
                        </p>
                      )}
                      {chatConvId && (
                        <p className="text-sm font-medium truncate">{chatConvTitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {/* User list */}
                    {!chatUserId && (
                      loadingChat ? (
                        <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                      ) : chatUsers.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">Пользователи не найдены</div>
                      ) : (
                        <div className="divide-y">
                          {chatUsers.map((u) => (
                            <button
                              key={u.id}
                              className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center gap-3 transition-colors"
                              onClick={() => handleSelectChatUser(u.id)}
                            >
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                                {u.name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{u.name}</p>
                                <Badge variant={roleBadgeMap[u.role]?.variant || 'outline'} className="text-[10px] px-1.5 py-0">
                                  {roleBadgeMap[u.role]?.label || u.role}
                                </Badge>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </button>
                          ))}
                        </div>
                      )
                    )}

                    {/* Conversation list */}
                    {chatUserId && !chatConvId && (
                      loadingChat ? (
                        <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
                      ) : chatConvs.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">Нет переписок</div>
                      ) : (
                        <div className="divide-y">
                          {chatConvs.map((c) => (
                            <button
                              key={c.id}
                              className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                              onClick={() => handleSelectConversation(c)}
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant={c.type === 'order' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                  {c.type === 'order' ? '📋 Заказ' : '👤 Личное'}
                                </Badge>
                                <span className="text-sm font-medium truncate">{c.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage || 'Нет сообщений'} · {c.messageCount} сооб.</p>
                            </button>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Right panel: Messages */}
                <div className="hidden sm:flex flex-1 flex-col">
                  {chatConvId ? (
                    <>
                      <div className="p-3 border-b flex items-center gap-2">
                        <Badge variant={chatConvType === 'order' ? 'default' : 'secondary'}>
                          {chatConvType === 'order' ? 'Заказ' : 'Личное'}
                        </Badge>
                        <span className="text-sm font-medium truncate">{chatConvTitle}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {loadingChat ? (
                          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-3/4" />)}</div>
                        ) : chatMessages.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Нет сообщений</div>
                        ) : (
                          chatMessages.map((m) => (
                            <div key={m.id} className={`flex gap-2 ${m.senderId === chatUserId ? '' : 'justify-end'}`}>
                              <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                                m.senderId === chatUserId
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}>
                                <p className="font-medium text-xs opacity-80 mb-0.5">{m.sender.name || 'Неизвестный'}</p>
                                <p className="break-words whitespace-pre-wrap">{m.content}</p>
                                {m.attachmentName && (
                                  <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
                                    📎 {m.attachmentName}
                                  </p>
                                )}
                                <p className="text-[10px] opacity-60 mt-1">{formatDate(m.createdAt)}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Inbox className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Выберите переписку для просмотра</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ TAB 3: Analytics ═══════ */}
        <TabsContent value="analytics" className="mt-4 space-y-6">
          {/* Stats cards */}
          {loadingStats ? (
            <StatsSkeleton />
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Всего пользователей" value={stats.users.total} sub={`Заказчики: ${stats.users.clients} · Исполнители: ${stats.users.executors}`} color="bg-violet-500" />
              <StatCard icon={Briefcase} label="Всего заказов" value={stats.orders.total} sub={`Открытых: ${stats.orders.open} · В работе: ${stats.orders.inProgress}`} color="bg-amber-500" />
              <StatCard icon={CheckCircle2} label="Выполненных" value={stats.orders.completed} color="bg-green-500" />
              <StatCard icon={MessageSquare} label="Сообщений" value={stats.messages.total} color="bg-pink-500" />
              <StatCard icon={Send} label="Откликов" value={stats.responses.total} color="bg-orange-500" />
              <StatCard icon={MessageSquare} label="Диалогов" value={stats.conversations.total} color="bg-cyan-500" />
              <StatCard icon={FileText} label="Открытых заказов" value={stats.orders.open} color="bg-sky-500" />
              <StatCard icon={BarChart3} label="В работе" value={stats.orders.inProgress} color="bg-rose-500" />
            </div>
          ) : null}

          {/* Activity feed */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Лента активности</CardTitle>
              </div>
              {/* Filter buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Button
                  size="sm"
                  variant={activityFilter === null ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => handleActivityFilter(null)}
                >
                  Все
                </Button>
                {allActions.map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    variant={activityFilter === a ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => handleActivityFilter(a)}
                  >
                    {actionLabels[a]?.icon} {actionLabels[a]?.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : activityList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Нет записей активности</p>
                </div>
              ) : (
                <>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {activityList.map((a) => {
                      const al = actionLabels[a.action] || { label: a.action, icon: '📌' }
                      return (
                        <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 text-sm hover:bg-muted/50 transition-colors">
                          <span className="text-lg shrink-0 mt-0.5">{al.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{a.user?.name || 'Неизвестный'}</span>
                              <span className="text-muted-foreground">—</span>
                              <span>{al.label}</span>
                            </div>
                            {a.details && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                                {Object.entries(a.details).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/70">
                              <span>{formatDate(a.createdAt)}</span>
                              {a.ip && a.ip !== 'unknown' && <span>· IP: {a.ip}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {activityTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" disabled={activityPage <= 1} onClick={() => { const p = activityPage - 1; setActivityPage(p); fetchActivity(p, activityFilter) }}>Назад</Button>
                      <span className="text-sm text-muted-foreground">{activityPage} / {activityTotalPages}</span>
                      <Button variant="outline" size="sm" disabled={activityPage >= activityTotalPages} onClick={() => { const p = activityPage + 1; setActivityPage(p); fetchActivity(p, activityFilter) }}>Далее</Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}