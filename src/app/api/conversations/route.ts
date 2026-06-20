import { db } from '@/lib/db'
import { conversations, messages, users } from '@/lib/schema'
import { eq, or, and, desc, ne, sql } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/conversations — list user's direct conversations
export async function GET(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const userId = payload.userId

  try {
    // Find all conversations for this user
    const convs = await db.select({
      id: conversations.id,
      user1Id: conversations.user1Id,
      user2Id: conversations.user2Id,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId)))
    .orderBy(desc(conversations.updatedAt))

    // For each conversation, get the other user and last message
    const result = (await Promise.all(convs.map(async (conv) => {
      const peerId = conv.user1Id === userId ? conv.user2Id : conv.user1Id

      const [peer, lastMsg] = await Promise.all([
        db.select({ id: users.id, name: users.name, avatar: users.avatar }).from(users).where(eq(users.id, peerId)).limit(1),
        db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(desc(messages.createdAt)).limit(1),
      ])

      // Skip conversations with no messages
      if (!lastMsg[0]) return null

      const unreadRes = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(eq(messages.conversationId, conv.id), ne(messages.senderId, userId), eq(messages.read, false)))
      const unreadCount = Number(unreadRes[0]?.count || 0)

      return {
        id: conv.id,
        peer: peer[0] || { id: peerId, name: 'Удалённый пользователь' },
        lastMessage: {
          content: lastMsg[0].content,
          createdAt: lastMsg[0].createdAt,
          isMine: lastMsg[0].senderId === userId,
        },
        updatedAt: conv.updatedAt,
        unreadCount,
      }
    }))).filter(Boolean)

    return NextResponse.json({ conversations: result })
  } catch {
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}

// POST /api/conversations — create or find existing conversation
export async function POST(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { peerId } = await req.json()
  if (!peerId || peerId === payload.userId) {
    return NextResponse.json({ error: 'Некорректный пользователь' }, { status: 400 })
  }

  try {
    // Check if conversation already exists
    const existing = await db.select().from(conversations)
      .where(or(
        and(eq(conversations.user1Id, payload.userId), eq(conversations.user2Id, peerId)),
        and(eq(conversations.user1Id, peerId), eq(conversations.user2Id, payload.userId)),
      ))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ conversation: existing[0] })
    }

    // Create new conversation
    const now = new Date().toISOString()
    const [conv] = await db.insert(conversations).values({
      id: crypto.randomUUID(),
      user1Id: payload.userId,
      user2Id: peerId,
      createdAt: now,
      updatedAt: now,
    }).returning()

    return NextResponse.json({ conversation: conv }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Ошибка создания' }, { status: 500 })
  }
}