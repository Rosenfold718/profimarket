import { db } from '@/lib/db'
import { users, messages } from '@/lib/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// GET /api/admin/users/[id]/messages?conversationId=...&orderId=... — messages for a conversation/order for a user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const { id: userId } = await params
    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')
    const orderId = url.searchParams.get('orderId')

    if (!conversationId && !orderId) {
      return NextResponse.json({ error: 'Укажите conversationId или orderId' }, { status: 400 })
    }

    // Verify user exists
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

    const whereCondition = conversationId
      ? eq(messages.conversationId, conversationId)
      : eq(messages.orderId, orderId)

    const messagesList = await db
      .select({
        id: messages.id,
        content: messages.content,
        senderId: messages.senderId,
        read: messages.read,
        createdAt: messages.createdAt,
        attachmentUrl: messages.attachmentUrl,
        attachmentName: messages.attachmentName,
        attachmentType: messages.attachmentType,
        attachmentSize: messages.attachmentSize,
        senderName: users.name,
        senderAvatar: users.avatar,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(whereCondition)
      .orderBy(asc(messages.createdAt))
      .limit(500)

    const result = messagesList.map(m => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      read: m.read,
      createdAt: m.createdAt,
      attachmentUrl: m.attachmentUrl,
      attachmentName: m.attachmentName,
      attachmentType: m.attachmentType,
      attachmentSize: m.attachmentSize,
      sender: {
        name: m.senderName,
        avatar: m.senderAvatar,
      },
    }))

    return NextResponse.json({ messages: result })
  } catch (e) {
    console.error('Admin user messages error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки сообщений' }, { status: 500 })
  }
}