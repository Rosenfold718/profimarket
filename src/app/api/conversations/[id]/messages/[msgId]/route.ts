import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/conversations/[id]/messages/[msgId] — delete a single message (own only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const token = getTokenFromHeaders(_req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, msgId } = await params

  // Verify user is part of this conversation
  const conv = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv.length || (conv[0].user1Id !== payload.userId && conv[0].user2Id !== payload.userId)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  // Only allow deleting own messages (or any message if both users are participants)
  const msg = await db.select().from(messages).where(eq(messages.id, msgId)).limit(1)
  if (!msg.length) return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 })
  if (msg[0].conversationId !== id) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  try {
    await db.delete(messages).where(and(eq(messages.id, msgId), eq(messages.conversationId, id)))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}