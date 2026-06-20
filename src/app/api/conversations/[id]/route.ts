import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/schema'
import { eq, or, and, sql } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/conversations/[id] — delete conversation and all its messages
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(_req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params

  // Verify user is part of this conversation
  const conv = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv.length || (conv[0].user1Id !== payload.userId && conv[0].user2Id !== payload.userId)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  try {
    // Delete all messages in the conversation, then the conversation itself
    await db.delete(messages).where(eq(messages.conversationId, id))
    await db.delete(conversations).where(eq(conversations.id, id))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}