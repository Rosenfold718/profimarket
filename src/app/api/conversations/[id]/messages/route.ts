import { db } from '@/lib/db'
import { messages, conversations, users } from '@/lib/schema'
import { eq, and, ne, desc, sql } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

// GET /api/conversations/[id]/messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params

  // Verify user is part of this conversation
  const conv = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv.length || (conv[0].user1Id !== payload.userId && conv[0].user2Id !== payload.userId)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  const url = new URL(req.url)
  const since = url.searchParams.get('since')

  // Build where conditions
  const conditions = [eq(messages.conversationId, id)]
  if (since) {
    conditions.push(sql`${messages.createdAt} > ${since}`)
  }

  const msgs = await db.select({
    id: messages.id,
    content: messages.content,
    senderId: messages.senderId,
    read: messages.read,
    createdAt: messages.createdAt,
    sender: { name: users.name, avatar: users.avatar },
  })
  .from(messages)
  .leftJoin(users, eq(messages.senderId, users.id))
  .where(and(...conditions))
  .orderBy(desc(messages.createdAt))

  return NextResponse.json({ messages: msgs })
}

// POST /api/conversations/[id]/messages — send message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params

  // Verify user is part of this conversation
  const conv = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv.length || (conv[0].user1Id !== payload.userId && conv[0].user2Id !== payload.userId)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  const schema = z.object({ content: z.string().min(1, 'Введите сообщение').max(5000) })

  try {
    const body = await req.json()
    const { content } = schema.parse(body)

    const now = new Date().toISOString()
    const [msg] = await db.insert(messages).values({
      id: crypto.randomUUID(),
      conversationId: id,
      senderId: payload.userId,
      content: content.trim(),
      read: false,
      createdAt: now,
    }).returning()

    // Update conversation timestamp
    await db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, id))

    return NextResponse.json({ message: msg }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    console.error('Conversation message insert error:', e)
    return NextResponse.json({ error: 'Ошибка отправки сообщения' }, { status: 500 })
  }
}

// PATCH /api/conversations/[id]/messages — mark messages as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  await db.update(messages)
    .set({ read: true })
    .where(and(eq(messages.conversationId, id), ne(messages.senderId, payload.userId)))

  return NextResponse.json({ ok: true })
}