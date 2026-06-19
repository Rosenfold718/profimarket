import { db } from '@/lib/db'
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

  // Single query: fetch all orders where user is client or executor,
  // including category, both participants, and all messages (ordered desc).
  // In-memory processing for lastMessage, totalMessages, unreadCount avoids N+1.
  const orders = await db.order.findMany({
    where: {
      OR: [
        { clientId: userId },
        { executorId: userId },
        { messages: { some: { senderId: userId } } },
      ],
      messages: { some: {} },
    },
    include: {
      category: { select: { name: true } },
      client: { select: { id: true, name: true, avatar: true } },
      executor: { select: { id: true, name: true, avatar: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          createdAt: true,
          read: true,
          senderId: true,
          sender: { select: { name: true, avatar: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const chats = orders.map((order) => {
    const messages = order.messages
    const lastMessage = messages[0] || null
    const totalMessages = messages.length
    const unreadCount = messages.filter(
      (m) => !m.read && m.senderId !== userId,
    ).length

    const isClient = order.clientId === userId
    const isExecutor = order.executorId === userId
    let interlocutor = isClient ? order.executor : isExecutor ? order.client : null
    if (!interlocutor && lastMessage) {
      interlocutor = lastMessage.senderId === userId
        ? (isClient ? order.executor : order.client)
        : { id: lastMessage.senderId, name: lastMessage.sender.name }
    }
    if (!interlocutor) interlocutor = order.client

    return {
      orderId: order.id,
      title: order.title,
      status: order.status,
      city: order.city,
      categoryName: order.category?.name ?? null,
      interlocutor: interlocutor
        ? { id: interlocutor.id, name: interlocutor.name, avatar: ('avatar' in interlocutor ? (interlocutor as { avatar?: string }).avatar : undefined) }
        : null,
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderName: lastMessage.sender.name,
            senderAvatar: lastMessage.sender.avatar,
            isMine: lastMessage.senderId === userId,
            read: lastMessage.read,
          }
        : null,
      totalMessages,
      unreadCount,
    }
  })

  return NextResponse.json({ chats })
}