import { db } from '@/lib/db'
import { orders, messages, users, categories, conversations } from '@/lib/schema'
import { eq, and, or, desc, ne, sql } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const token =
    getTokenFromHeaders(req.headers) ||
    (() => {
      const c = req.cookies.get('token')
      return c?.value || null
    })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

  const userId = payload.userId

  try {
    // ─── 1. Order chats (orders where user is client/executor and has messages) ───
    const userOrders = await db.select({
      id: orders.id,
      title: orders.title,
      status: orders.status,
      city: orders.city,
      clientId: orders.clientId,
      executorId: orders.executorId,
      categoryId: orders.categoryId,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(or(eq(orders.clientId, userId), eq(orders.executorId, userId)))

    const orderChats = []
    for (const order of userOrders) {
      // Get last message for this order
      const lastMsgs = await db.select({
        id: messages.id,
        content: messages.content,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
        senderName: users.name,
        senderAvatar: users.avatar,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.orderId, order.id))
      .orderBy(desc(messages.createdAt))
      .limit(1)

      if (!lastMsgs.length) continue

      const lastMsg = lastMsgs[0]

      // Count total and unread messages
      const [counts] = await db.select({
        total: sql<number>`count(*)`,
        unread: sql<number>`sum(CASE WHEN ${messages.read} = 0 AND ${messages.senderId} != ${userId} THEN 1 ELSE 0 END)`,
      })
      .from(messages)
      .where(eq(messages.orderId, order.id))

      // Determine interlocutor
      const isClient = order.clientId === userId
      const interlocutorId = isClient ? order.executorId : order.clientId

      let interlocutor = { id: interlocutorId || '', name: 'Неизвестен', avatar: undefined as string | undefined, lastSeenAt: undefined as string | undefined }
      if (interlocutorId) {
        const [peer] = await db.select({ id: users.id, name: users.name, avatar: users.avatar, lastSeenAt: users.lastSeenAt })
          .from(users).where(eq(users.id, interlocutorId)).limit(1)
        if (peer) interlocutor = { id: peer.id, name: peer.name, avatar: peer.avatar ?? undefined, lastSeenAt: peer.lastSeenAt ?? undefined }
      }

      // Get category name
      let categoryName: string | null = null
      if (order.categoryId) {
        const [cat] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, order.categoryId)).limit(1)
        categoryName = cat?.name ?? null
      }

      orderChats.push({
        type: 'order',
        orderId: order.id,
        title: order.title,
        status: order.status,
        city: order.city,
        categoryName,
        interlocutor,
        lastMessage: {
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          senderName: lastMsg.senderName,
          isMine: lastMsg.senderId === userId,
          read: true, // not used for display logic
        },
        totalMessages: Number(counts.total),
        unreadCount: Number(counts.unread),
      })
    }

    // ─── 2. Direct conversations ───
    const convs = await db.select({
      id: conversations.id,
      user1Id: conversations.user1Id,
      user2Id: conversations.user2Id,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId)))
    .orderBy(desc(conversations.updatedAt))

    const directChats = []
    for (const conv of convs) {
      const peerId = conv.user1Id === userId ? conv.user2Id : conv.user1Id

      const [peer, lastMsg] = await Promise.all([
        db.select({ id: users.id, name: users.name, avatar: users.avatar, lastSeenAt: users.lastSeenAt }).from(users).where(eq(users.id, peerId)).limit(1),
        db.select({
          content: messages.content,
          createdAt: messages.createdAt,
          senderId: messages.senderId,
        }).from(messages).where(eq(messages.conversationId, conv.id)).orderBy(desc(messages.createdAt)).limit(1),
      ])

      if (!lastMsg[0]) continue

      const [unreadRes] = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(eq(messages.conversationId, conv.id), ne(messages.senderId, userId), eq(messages.read, false)))

      directChats.push({
        type: 'direct',
        id: conv.id,
        peer: peer[0] ? { ...peer[0], lastSeenAt: peer[0].lastSeenAt ?? undefined } : { id: peerId, name: 'Удалённый пользователь', avatar: undefined, lastSeenAt: undefined },
        lastMessage: {
          content: lastMsg[0].content,
          createdAt: lastMsg[0].createdAt,
          isMine: lastMsg[0].senderId === userId,
        },
        updatedAt: conv.updatedAt,
        unreadCount: Number(unreadRes?.count || 0),
      })
    }

    // Sort combined by last activity
    const all = [...orderChats, ...directChats].sort((a, b) => {
      const timeA = a.type === 'order' ? a.lastMessage?.createdAt : a.updatedAt
      const timeB = b.type === 'order' ? b.lastMessage?.createdAt : b.updatedAt
      return new Date(timeB || 0).getTime() - new Date(timeA || 0).getTime()
    })

    return NextResponse.json({ chats: all })
  } catch (e) {
    console.error('Chats API error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}