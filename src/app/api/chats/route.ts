import { db } from '@/lib/db'
import { orders, messages, users, categories } from '@/lib/schema'
import { eq, and, or, desc } from 'drizzle-orm'
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

  // Fetch all orders where user is client, executor, or has sent a message,
  // and that have at least one message.
  // We fetch orders with messages ordered desc, then compute lastMessage,
  // totalMessages, unreadCount in-memory.
  const allOrders = await db.query.orders.findMany({
    where: or(
      eq(orders.clientId, userId),
      eq(orders.executorId, userId),
    ),
    with: {
      category: { columns: { name: true } },
      client: { columns: { id: true, name: true, avatar: true } },
      executor: { columns: { id: true, name: true, avatar: true } },
      messages: {
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        with: {
          sender: { columns: { name: true, avatar: true } },
        },
      },
    },
    orderBy: (orders, { desc }) => [desc(orders.updatedAt)],
  })

  // Filter orders that have messages
  const ordersWithMessages = allOrders.filter(o => o.messages.length > 0)

  const chats = ordersWithMessages.map((order) => {
    const msgs = order.messages
    const lastMessage = msgs[0] || null
    const totalMessages = msgs.length
    const unreadCount = msgs.filter(
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
