import { db } from '@/lib/db'
import { users, orders, messages, conversations } from '@/lib/schema'
import { eq, or, and, sql, count, desc } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// GET /api/admin/users/[id]/conversations — all conversations for a user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const { id: userId } = await params

    // Verify user exists
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

    const result: Array<{
      id: string
      title: string
      type: 'order' | 'direct'
      lastMessage: string | null
      messageCount: number
      updatedAt: string
    }> = []

    // 1. Order-based conversations (orders where user is client or executor with messages)
    const orderRows = await db.run(sql`
      SELECT o.id, o.title, o.updatedAt,
             (SELECT COUNT(*) FROM Message m WHERE m.orderId = o.id) as msgCount,
             (SELECT m2.content FROM Message m2 WHERE m2.orderId = o.id ORDER BY m2.createdAt DESC LIMIT 1) as lastMsg
      FROM \`Order\` o
      WHERE (o.clientId = ${userId} OR o.executorId = ${userId})
        AND EXISTS (SELECT 1 FROM Message m WHERE m.orderId = o.id)
      ORDER BY o.updatedAt DESC
    `) as Array<{ id: string; title: string; updatedAt: string; msgCount: number; lastMsg: string | null }>

    for (const r of orderRows) {
      result.push({
        id: r.id,
        title: r.title,
        type: 'order',
        lastMessage: r.lastMsg,
        messageCount: r.msgCount,
        updatedAt: r.updatedAt,
      })
    }

    // 2. Direct conversations (Conversation table)
    const convRows = await db
      .select({
        id: conversations.id,
        user1Id: conversations.user1Id,
        user2Id: conversations.user2Id,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId)))
      .orderBy(desc(conversations.updatedAt))

    for (const c of convRows) {
      const peerId = c.user1Id === userId ? c.user2Id : c.user1Id
      const peer = await db.query.users.findFirst({
        where: eq(users.id, peerId),
        columns: { id: true, name: true },
      })

      const [msgInfo] = await db
        .select({
          content: messages.content,
          cnt: count(),
        })
        .from(messages)
        .where(eq(messages.conversationId, c.id))

      result.push({
        id: c.id,
        title: peer?.name || 'Неизвестный',
        type: 'direct',
        lastMessage: msgInfo?.content || null,
        messageCount: msgInfo?.cnt || 0,
        updatedAt: c.updatedAt,
      })
    }

    // Sort by updatedAt desc
    result.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))

    return NextResponse.json({ conversations: result })
  } catch (e) {
    console.error('Admin user conversations error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки переписок' }, { status: 500 })
  }
}